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

// YouBarNotificationsButton isn't registered until YouBar itself has rendered at least once -
// retries on an interval until it lands.
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
