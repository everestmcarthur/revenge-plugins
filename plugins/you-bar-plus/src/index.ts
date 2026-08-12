import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import patchYouBarButtons from "./patches/youBarButtons";
import { setInboxTracking } from "./lib/notifications";
import Settings from "./ui/Settings";

let unpatchButtons: () => void = () => {};

export default {
    onLoad: () => {
        storage.showDMButton ??= false;
        storage.showSettingsButton ??= true;
        storage.showInboxButton ??= false;
        storage.notifications ??= [];

        setInboxTracking(!!storage.showInboxButton);

        try {
            unpatchButtons = patchYouBarButtons();
        } catch (e) {
            logger.error(`[YouBar+] Failed to apply the "YouBar buttons" patch: ${e}`);
        }
    },
    onUnload: () => {
        unpatchButtons();
        setInboxTracking(false);
    },
    settings: Settings
};
