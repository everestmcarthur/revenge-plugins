import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchChat from "./patches/chat";
import patchDetails from "./patches/details";
import patchName from "./patches/name";
import patchProfile from "./patches/profile";
import patchTag from "./patches/tag";
import Settings from "./ui/pages/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.useRoleColor ??= false;
        storage.tags ??= {};

        unpatchAll = guardPlugin(id, () => applyPatches("Staff Tags", logger, {
            tag: patchTag,
            chat: patchChat,
            name: patchName,
            details: patchDetails,
            profile: patchProfile
        }));
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
