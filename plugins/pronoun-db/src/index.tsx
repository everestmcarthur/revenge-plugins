import { logger } from "@vendetta";
import { find } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import PronounSection from "./ui/PronounSection";
import Settings from "./ui/Settings";

// Discord renamed the top-level profile component from "UserProfile" to "UserProfileContent" at
// some point (confirmed against decompiled current-build source) - checking both names covers
// whichever one a given Discord build actually uses.
const UserProfile =
    find((m: any) => m?.type?.name === "UserProfileContent") ??
    find((m: any) => m?.type?.name === "UserProfile");

function patchProfile(): () => void {
    if (!UserProfile) return () => {};

    return after("type", UserProfile, (_: any, res: any) => {
        try {
            // Same story here - the bio card component is now named "UserProfileAboutMeCard",
            // was "UserProfileBio" in older builds.
            const bioSection = findInReactTree(res, (r) =>
                Array.isArray(r?.props?.children) &&
                r.props.children.some((c: any) => c?.type?.name === "UserProfileAboutMeCard" || c?.type?.name === "UserProfileBio")
            );

            const children = bioSection?.props?.children;
            if (!Array.isArray(children)) return;

            const withProfile = children.find((c: any) => typeof c?.props?.displayProfile?.userId === "string");
            const userId = withProfile?.props?.displayProfile?.userId;
            if (!userId) return;

            children.unshift(<PronounSection userId={userId} />);
        } catch {
            // One broken profile card render shouldn't spam errors on every profile open.
        }
    });
}

let unpatch: () => void = () => {};

export default {
    onLoad: () => {
        try {
            unpatch = patchProfile();
        } catch (e) {
            logger.error(`[PronounDB] Failed to apply the profile patch: ${e}`);
        }
    },
    onUnload: () => unpatch(),
    settings: Settings
};
