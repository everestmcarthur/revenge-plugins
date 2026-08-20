import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchChat from "./patches/chat";
import patchName from "./patches/name";
import patchDetails from "./patches/details";
import patchProfile from "./patches/profile";
import patchTag from "./patches/tag";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.tags ??= {};

        unpatchAll = guardPlugin(id, () => applyPatches("Custom User Tags", logger, {
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
