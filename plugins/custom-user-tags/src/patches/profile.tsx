import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import resolveTag from "../lib/resolveTag";
import CustomTag from "../ui/Tag";

/**
 * Full profile screen tag - see Staff Tags' own `patches/profile.tsx` (same repo pattern, worked
 * out together in the same live session, see /root/evals-for-rn) for the full writeup of why this
 * needs `createElement`/`jsx` interception rather than patching `UserProfileContent` and searching
 * its output: `UserProfilePrimaryInfo` (the component that actually renders the name+tag row) is
 * only ever created as an implementation detail several layers deep, unreachable by a Metro module
 * search, and receives `user` directly as its own prop - so `registerTypeDetector` catches the
 * first render to recover the live reference, and `registerIntercept` swaps in a wrapper for every
 * later use, no separate context-passing patch needed.
 *
 * Unlike Staff Tags, `resolveTag` only needs a `userId` - no guild/permission context - so this
 * doesn't need `guildId` from props at all.
 */
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
