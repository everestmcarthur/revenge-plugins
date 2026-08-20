import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchTypingIndicator from "./patches/typingIndicator";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = guardPlugin(id, () => applyPatches("TypingAvatars", logger, {
            "typing indicator avatars": patchTypingIndicator
        }));
    },
    onUnload: () => unpatchAll()
};
