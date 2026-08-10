import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import resolveTag from "../lib/resolveTag";
import CustomTag from "../ui/Tag";

// Same approach as Staff Tags' patches/profile.tsx: UserProfilePrimaryInfo builds the name row but
// isn't a top-level export, so we grab it via createElementIntercept. Unlike Staff Tags, resolveTag
// only needs a userId, no guild context, so we don't bother reading guildId here.
export default function patchProfile(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "custom-user-tags-profile-primary-info",
        (type) => typeof type === "function" && type.name === "UserProfilePrimaryInfo",
        (UserProfilePrimaryInfo: any) => {
            const PatchedUserProfilePrimaryInfo = (props: any) => {
                const ret = UserProfilePrimaryInfo(props);

                try {
                    const userId: string | undefined = props?.user?.id;
                    if (!userId) return ret;

                    const tag = resolveTag(userId);
                    if (!tag) return ret;

                    const row = findInReactTree(
                        ret,
                        (c: any) =>
                            Array.isArray(c?.props?.children) &&
                            c.props.children.some((ch: any) => ch?.type?.name === "UserTagAndPronouns")
                    );
                    if (!Array.isArray(row?.props?.children)) return ret;

                    row.props.children.push(<CustomTag tag={tag} />);
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
