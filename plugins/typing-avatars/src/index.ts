import { logger } from "@vendetta";
import { applyPatches } from "@shared/lib/patcher";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("TypingAvatars", logger, {});
    },
    onUnload: () => unpatchAll()
};
