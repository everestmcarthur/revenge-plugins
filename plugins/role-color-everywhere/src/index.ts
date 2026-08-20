import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import patchRows from "./patches/rows";
import patchMemberList from "./patches/memberList";
import patchTypingWrapper from "./patches/typingWrapper";
import patchVoiceUserConnected from "./patches/voiceUserConnected";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        storage.noMention ??= false;
        storage.noRole ??= false;
        storage.noVoice ??= false;
        storage.hideTyping ??= false;
        storage.chatInterpolation ??= 0;

        unpatchAll = guardPlugin(id, () => applyPatches("RoleColorEverywhere", logger, {
            "mentions & chat text": patchRows,
            "member list role headers": patchMemberList,
            "typing indicator": patchTypingWrapper,
            "voice channel names": patchVoiceUserConnected
        }));
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
