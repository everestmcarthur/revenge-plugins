import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import patchRows from "./patches/rows";
import patchMemberList from "./patches/memberList";
import patchTypingWrapper from "./patches/typingWrapper";
import patchVoiceUserConnected from "./patches/voiceUserConnected";
import Settings from "./ui/Settings";

let patches: (() => void)[] = [];

function safePatch(name: string, apply: () => () => void): () => void {
    try {
        return apply();
    } catch (e) {
        logger.error(`[RoleColorEverywhere] Failed to apply the "${name}" patch, that surface will be skipped: ${e}`);
        return () => {};
    }
}

export default {
    onLoad: () => {
        storage.noMention ??= false;
        storage.noRole ??= false;
        storage.noVoice ??= false;
        storage.hideTyping ??= false;
        storage.chatInterpolation ??= 0;

        patches = [
            safePatch("mentions & chat text", patchRows),
            safePatch("member list role headers", patchMemberList),
            safePatch("typing indicator", patchTypingWrapper),
            safePatch("voice channel names", patchVoiceUserConnected)
        ];
    },
    onUnload: () => patches.forEach((unpatch) => unpatch()),
    settings: Settings
};
