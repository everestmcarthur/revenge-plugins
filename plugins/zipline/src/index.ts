import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchAutoProcess from "./patches/autoProcess";
import { zStorage } from "./lib/api";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        zStorage();

        unpatchAll = guardPlugin(id, () => applyPatches("Zipline", logger, {
            autoProcess: patchAutoProcess,
        }));
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
