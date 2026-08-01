import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchChat from "./patches/chat";
import patchDetails from "./patches/details";
import patchName from "./patches/name";
import patchTag from "./patches/tag";
import Settings from "./ui/pages/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.useRoleColor ??= false;
        storage.tags ??= {};

        unpatchAll = applyPatches("Staff Tags", logger, {
            tag: patchTag,
            chat: patchChat,
            name: patchName,
            details: patchDetails
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
