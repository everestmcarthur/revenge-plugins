import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchYouBarButtons from "./patches/youBarButtons";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.showDMButton ??= false;
        storage.showSettingsButton ??= true;

        unpatchAll = applyPatches("YouBar+", logger, {
            "YouBar buttons": patchYouBarButtons
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
