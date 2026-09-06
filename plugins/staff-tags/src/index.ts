import { logger } from "@vendetta";
import { storage, id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import patchChat from "./patches/chat";
import patchDetails from "./patches/details";
import patchName from "./patches/name";
import patchProfile from "./patches/profile";
import patchTag from "./patches/tag";
import Settings from "./ui/pages/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;
        storage.useRoleColor ??= false;
        storage.tags ??= {};

        unpatchAll = applyPatches("Staff Tags", logger, {
            tag: patchTag,
            chat: patchChat,
            name: patchName,
            details: patchDetails,
            profile: patchProfile
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
