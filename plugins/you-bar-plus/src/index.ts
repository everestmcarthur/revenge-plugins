import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import patchYouBarButtons from "./patches/youBarButtons";
import Settings from "./ui/Settings";

// Bumped by hand whenever the patch logic meaningfully changes - logged on every load so "did the
// update actually land" (a real, repeated source of confusion this whole rebuild, between GitHub
// Pages' CDN cache and Revenge's own plugin-update caching) can be answered by checking Revenge's
// debug log instead of guessing.
const BUILD_MARKER = "youbar-plus-v2-toast-anchor";

let unpatch: () => void = () => {};

export default {
    onLoad: () => {
        storage.showDMButton ??= false;
        storage.showSettingsButton ??= true;

        logger.log(`[YouBar+] loading (${BUILD_MARKER})`);

        try {
            unpatch = patchYouBarButtons();
        } catch (e) {
            logger.error(`[YouBar+] Failed to apply patches, buttons will not appear: ${e}`);
            unpatch = () => {};
        }
    },
    onUnload: () => unpatch(),
    settings: Settings
};
