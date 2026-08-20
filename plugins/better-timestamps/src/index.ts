import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchRowManager from "./patches/rowManager";
import patchTimestamp from "./patches/timestamp";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.selected ??= "calendar";
        storage.customFormat ??= "dddd, MMMM Do YYYY, h:mm:ss a";
        storage.separateMessages ??= false;

        unpatchAll = guardPlugin(id, () => applyPatches("BetterTimestamps", logger, {
            "message & day timestamps": patchRowManager,
            "message timestamp component": patchTimestamp
        }));
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
