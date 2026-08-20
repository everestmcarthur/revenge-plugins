import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { rawFindByTypeName } from "@shared/lib/rawFind";
import { guardPlugin } from "@shared/lib/guard";
import PronounSection from "./ui/PronounSection";
import Settings from "./ui/Settings";

// find() caches a negative result forever, so retrying it after onLoad races module registration
// never works - rawFindByTypeName scans window.modules directly instead. Checks both names since
// Discord renamed the top-level profile component from "UserProfile" to "UserProfileContent".
function getUserProfile(): any {
    return rawFindByTypeName("UserProfileContent") ?? rawFindByTypeName("UserProfile");
}

function patchProfile(): (() => void) | false {
    const UserProfile = getUserProfile();
    if (!UserProfile) return false;

    return after("type", UserProfile, (_: any, res: any) => {
        try {
            // "UserProfileAboutMeCard" now, "UserProfileBio" in older builds.
            const bioSection = findInReactTree(res, (r) =>
                Array.isArray(r?.props?.children) &&
                r.props.children.some((c: any) => c?.type?.name === "UserProfileAboutMeCard" || c?.type?.name === "UserProfileBio")
            );

            const children = bioSection?.props?.children;
            if (!Array.isArray(children)) return;

            // userId is a direct prop on these cards now, falling back to the older nested path.
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

let teardown: () => void = () => {};

export default {
    onLoad: () => {
        teardown = guardPlugin(id, () => {
            attempt();
            if (!patched) {
                let ticks = 0;
                retryHandle = setInterval(() => {
                    attempt();
                    if (++ticks >= 30) stopRetrying(); // ~9s at 300ms, then give up
                }, 300);
            }
            return () => {
                stopRetrying();
                unpatch();
            };
        });
    },
    onUnload: () => teardown(),
    settings: Settings
};
