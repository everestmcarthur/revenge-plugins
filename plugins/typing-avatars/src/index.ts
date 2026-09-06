import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import patchTypingIndicator from "./patches/typingIndicator";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;
        unpatchAll = applyPatches("TypingAvatars", logger, {
            "typing indicator avatars": patchTypingIndicator
        });
    },
    onUnload: () => unpatchAll()
};
