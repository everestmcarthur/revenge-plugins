import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchYouBarButtons from "./patches/youBarButtons";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.slot1 ??= "dms";
        storage.slot2 ??= "settings";

        unpatchAll = applyPatches("YouBar+", logger, {
            "YouBar buttons": patchYouBarButtons
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
