import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRowManager from "./patches/rowManager";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.selected ??= "calendar";
        storage.customFormat ??= "dddd, MMMM Do YYYY, h:mm:ss a";
        storage.separateMessages ??= false;

        unpatchAll = applyPatches("BetterTimestamps", logger, {
            "message & day timestamps": patchRowManager
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
