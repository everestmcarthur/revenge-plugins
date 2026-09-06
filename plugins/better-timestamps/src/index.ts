import { logger } from "@vendetta";
import { storage, id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import patchRowManager from "./patches/rowManager";
import patchTimestamp from "./patches/timestamp";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;

        storage.selected ??= "calendar";
        storage.customFormat ??= "dddd, MMMM Do YYYY, h:mm:ss a";
        storage.separateMessages ??= false;

        unpatchAll = applyPatches("BetterTimestamps", logger, {
            "message & day timestamps": patchRowManager,
            "message timestamp component": patchTimestamp
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
