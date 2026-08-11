import { logger } from "@vendetta";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { rawFindByTypeName } from "@shared/lib/rawFind";
import PronounSection from "./ui/PronounSection";
import Settings from "./ui/Settings";

// @vendetta/metro's find() caches a negative result forever, including one that only missed
// because this plugin's onLoad ran before UserProfileContent's module had registered yet - once
// cached, no amount of retrying with find() would ever see the real module. rawFindByTypeName
// scans window.modules directly instead, so retrying it actually works. Confirmed live: this
// exact search + the findInReactTree logic below both work correctly once given a real reference
// - the only thing broken was find()'s one-shot, permanently-cached lookup.
//
// Discord renamed the top-level profile component from "UserProfile" to "UserProfileContent" at
// some point (confirmed against decompiled current-build source) - checking both names covers
// whichever one a given Discord build actually uses.
function getUserProfile(): any {
    return rawFindByTypeName("UserProfileContent") ?? rawFindByTypeName("UserProfile");
}

function patchProfile(): (() => void) | false {
    const UserProfile = getUserProfile();
    if (!UserProfile) return false;

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

            // userId is a direct prop on these cards now, not nested under displayProfile.userId
            // - keeping the old path as a fallback in case another build still shapes it that way.
            const withProfile = children.find(
                (c: any) => typeof c?.props?.userId === "string" || typeof c?.props?.displayProfile?.userId === "string"
            );
            const userId = withProfile?.props?.userId ?? withProfile?.props?.displayProfile?.userId;
            if (!userId) return;

            children.unshift(<PronounSection userId={userId} />);
        } catch {
            // One broken profile card render shouldn't spam errors on every profile open.
        }
    });
}

let unpatch: () => void = () => {};
let patched = false;
let retryHandle: ReturnType<typeof setInterval> | undefined;

function stopRetrying() {
    if (retryHandle) {
        clearInterval(retryHandle);
        retryHandle = undefined;
    }
}

function attempt() {
    try {
        const result = patchProfile();
        if (result) {
            unpatch = result;
            patched = true;
            stopRetrying();
        }
    } catch (e) {
        logger.error(`[PronounDB] Failed to apply the profile patch: ${e}`);
        stopRetrying();
    }
}

export default {
    onLoad: () => {
        attempt();
        if (!patched) {
            let ticks = 0;
            retryHandle = setInterval(() => {
                attempt();
                if (++ticks >= 30) stopRetrying(); // ~9s at 300ms, then give up
            }, 300);
        }
    },
    onUnload: () => {
        stopRetrying();
        unpatch();
    },
    settings: Settings
};
