import { logger } from "@vendetta";
import { applyPatches } from "@shared/lib/patcher";
import patchAutoProcess from "./patches/autoProcess";
import { zStorage } from "./lib/api";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        zStorage();

        unpatchAll = applyPatches("Zipline", logger, {
            autoProcess: patchAutoProcess,
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
