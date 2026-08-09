import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import patchYouBarButtons from "./patches/youBarButtons";
import Settings from "./ui/Settings";

let unpatchButtons: () => void = () => {};
let patched = false;
let retryHandle: ReturnType<typeof setInterval> | undefined;

function stopRetrying() {
    if (retryHandle) {
        clearInterval(retryHandle);
        retryHandle = undefined;
    }
}

// YouBarNotificationsButton isn't registered in Metro until the YouBar itself has rendered at
// least once, which hasn't necessarily happened yet by the time a plugin's onLoad runs - a single
// attempt just misses it some of the time. Retries on an interval until it lands, then stops.
function attempt() {
    try {
        const unpatch = patchYouBarButtons();
        if (unpatch) {
            unpatchButtons = unpatch;
            patched = true;
            stopRetrying();
        }
    } catch (e) {
        logger.error(`[YouBar+] Failed to apply the "YouBar buttons" patch: ${e}`);
        stopRetrying();
    }
}

export default {
    onLoad: () => {
        storage.showDMButton ??= false;
        storage.showSettingsButton ??= true;

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
        unpatchButtons();
    },
    settings: Settings
};
