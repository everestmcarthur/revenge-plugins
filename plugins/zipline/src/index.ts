import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import patchAutoProcess from "./patches/autoProcess";
import { zStorage } from "./lib/api";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;
        zStorage();

        unpatchAll = applyPatches("Zipline", logger, {
            autoProcess: patchAutoProcess,
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
