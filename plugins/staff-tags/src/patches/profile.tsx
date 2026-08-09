import { findByStoreName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import getTag from "../lib/getTag";
import GradientTag from "../ui/GradientTag";

const GuildStore = findByStoreName("GuildStore");

/**
 * Full profile screen tag, live-verified end to end (see /root/evals-for-rn for the session this
 * was worked out in, and the Next repo's `staff-tags` `patches/details.tsx` for the exact same
 * class of bug this replaces one of).
 *
 * The full profile doesn't render through `UserRow` (member list/profile popout) at all - it's a
 * separate tree, `UserProfileContent` -> `PrimaryInfo` -> `UserProfilePrimaryInfo`, and neither
 * `PrimaryInfo` nor `UserProfileContent` carry a rendered name+tag row worth patching:
 * `PrimaryInfo` only ever appears as an *unrendered* `<PrimaryInfo user=... guildId=... />`
 * element inside `UserProfileContent`'s own output (confirmed live it has no `children` at that
 * point, so searching inside it for anything finds nothing, silently, no matter how good the
 * search predicate is). `UserProfilePrimaryInfo` is the component that actually renders the name
 * row and, conveniently, receives `user`/`guildId` directly as its own props - no need to also
 * patch `UserProfileContent` just to recover context.
 *
 * `UserProfilePrimaryInfo` can't be found by a Metro module search the way `UserProfileContent`
 * is above (confirmed live - it isn't a top-level export findByProps/findByTypeName can reach,
 * only ever created as an implementation detail inside `PrimaryInfo`'s own render). Patching
 * `React.createElement`/the `jsx` runtime (`@shared/lib/createElementIntercept`) sidesteps that:
 * `registerTypeDetector` observes the *first* time anything, anywhere, creates an element with
 * this name, handing back the live function reference the moment it exists - then
 * `registerIntercept` swaps in our own wrapper for every future use of that exact reference,
 * including the one that triggered the detector (both run synchronously inside the same
 * `createElement`/`jsx` call, so even the very first render is already patched).
 *
 * Confirmed live, `UserProfilePrimaryInfo` renders:
 * `<View>[<DisplayName/>, <View>[<UserTagAndPronouns/>, <GuildTag/>, <ProfileBadgeRows/>]]</View>`
 * - `UserTagAndPronouns` is Discord's `@username` handle + pronouns display, not a badge slot
 * (misleading name); `GuildTag` is Discord's own unrelated "server tag" feature; `ProfileBadgeRows`
 * is Nitro/HypeSquad-style badges. None of these read custom text/color, so - same lesson as the
 * member list's `BotTag` - the fix pushes the plugin's own `GradientTag` as a new sibling in that
 * inner row rather than trying to repurpose any of them.
 */
export default function patchProfile(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "staff-tags-profile-primary-info",
        (type) => typeof type === "function" && type.name === "UserProfilePrimaryInfo",
        (UserProfilePrimaryInfo: any) => {
            const PatchedUserProfilePrimaryInfo = (props: any) => {
                const ret = UserProfilePrimaryInfo(props);

                try {
                    const { user, guildId } = props ?? {};
                    if (!user) return ret;

                    const guild = guildId ? GuildStore?.getGuild(guildId) : undefined;
                    const tag = getTag(guild, undefined, user);
                    if (!tag) return ret;

                    const row = findInReactTree(
                        ret,
                        (c: any) =>
                            Array.isArray(c?.props?.children) &&
                            c.props.children.some((ch: any) => ch?.type?.name === "UserTagAndPronouns")
                    );
                    if (!Array.isArray(row?.props?.children)) return ret;

                    row.props.children.push(
                        <GradientTag
                            text={tag.text}
                            textColor={tag.textColor}
                            backgroundColor={tag.backgroundColor}
                            gradientColor={tag.gradientColor}
                            icon={tag.icon}
                            iconColor={tag.iconColor}
                        />
                    );
                } catch {
                    // Skip - a broken profile tag beats a crashed profile screen.
                }

                return ret;
            };

            registerIntercept(UserProfilePrimaryInfo, PatchedUserProfilePrimaryInfo);
        }
    );

    return () => cleanups.forEach((fn) => fn());
}
