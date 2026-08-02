import { find, findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import getTag from "../lib/getTag";

// Same top-level profile component PronounDB already confirmed works on current Discord (the
// findByName-based lookup this repo used to use for it stopped matching after a rename, but this
// predicate-based find still succeeds). The full profile screen doesn't render through UserRow the
// way member list rows and the old "profile popout" did - this is a separate component entirely,
// which is why tags weren't showing up here even though details.tsx's own patch is working fine.
const UserProfile =
    find((m: any) => m?.type?.name === "UserProfileContent") ??
    find((m: any) => m?.type?.name === "UserProfile");

const TagModule = findByProps("getBotLabel");
const GuildStore = findByStoreName("GuildStore");
const UserStore = findByStoreName("UserStore");

/**
 * Not independently confirmed against a live render the way most of this repo's fixes are - the
 * exact prop shape passed to this component's render (userId vs. a full user object, whether
 * guildId is even present) isn't verified on-device yet, so this pulls from whichever of several
 * plausible field names is actually present rather than assuming one. Every step is guarded, so a
 * wrong assumption just means no tag appears here, not a crash.
 */
export default function patchProfile(): () => void {
    if (!UserProfile) return () => {};

    return after("type", UserProfile, (args: any[], res: any) => {
        try {
            const props = args?.[0] ?? {};
            const userId: string | undefined = props.userId ?? props.user?.id ?? props.displayProfile?.userId;
            if (!userId) return;

            const user = props.user ?? UserStore?.getUser?.(userId);
            if (!user) return;

            const guildId: string | undefined = props.guildId;
            const guild = guildId ? GuildStore?.getGuild(guildId) : undefined;

            const tag = getTag(guild, undefined, user);
            if (!tag) return;

            const primaryInfo = findInReactTree(res, (c) => c?.type?.name === "PrimaryInfo" || c?.type?.displayName === "PrimaryInfo");
            if (!primaryInfo) return;

            const existingTag = findInReactTree(primaryInfo, (c) => c?.type?.Types);
            if (existingTag && existingTag.props?.type !== 0) return;

            if (existingTag) {
                Object.assign(existingTag.props, {
                    type: 0,
                    text: tag.text,
                    textColor: tag.textColor,
                    backgroundColor: tag.backgroundColor,
                    verified: false
                });
                return;
            }

            const nameRow = findInReactTree(
                primaryInfo,
                (c) =>
                    Array.isArray(c?.props?.children) &&
                    c.props.children.some((ch: any) => typeof ch === "string" || typeof ch?.props?.children === "string")
            );
            if (!Array.isArray(nameRow?.props?.children) || !TagModule) return;

            nameRow.props.children.push(
                <TagModule.default
                    type={0}
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    verified={false}
                />
            );
        } catch {
            // Skip - a broken profile tag beats a crashed profile screen.
        }
    });
}
