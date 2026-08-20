import { logger } from "@vendetta";
import { applyPatches } from "@shared/lib/patcher";
import patchTypingIndicator from "./patches/typingIndicator";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("TypingAvatars", logger, {
            "typing indicator avatars": patchTypingIndicator
        });
    },
    onUnload: () => unpatchAll()
};
