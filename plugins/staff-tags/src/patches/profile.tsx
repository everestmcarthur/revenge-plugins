import { findByStoreName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import getTag from "../lib/getTag";
import GradientTag from "../ui/GradientTag";

const GuildStore = findByStoreName("GuildStore");

// The full profile doesn't render through UserRow at all - it's PrimaryInfo -> UserProfilePrimaryInfo,
// and PrimaryInfo only shows up unrendered inside UserProfileContent's own output (no children to
// search). UserProfilePrimaryInfo is the one that actually builds the name row, and it's not a
// top-level export, so we grab its reference via createElementIntercept the first time it renders.
// The row it builds is [DisplayName, [UserTagAndPronouns, GuildTag, ProfileBadgeRows]] - none of
// those read custom text/color (UserTagAndPronouns is just the @handle, GuildTag is Discord's own
// server-tag feature), so we push our GradientTag in as a sibling instead of trying to reuse one.
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
