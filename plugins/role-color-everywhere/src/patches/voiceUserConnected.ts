import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { defaultTextColor } from "../lib/color";

export default function patchVoiceUserConnected(): () => void {
    const VoiceUserConnected = findByName("VoiceUserConnected", false);
    if (!VoiceUserConnected) return () => {};

    return after("default", VoiceUserConnected, ([args]: any[], res: any) => {
        try {
            if (storage.noVoice || !res?.type) return;

            const usesRender = !!res.type.prototype?.render;
            const hook = usesRender ? "render" : "type";
            const target = usesRender ? res.type.prototype : res.type;

            const unpatch = after(hook, target, (_: any, innerRes: any) => {
                try {
                    unpatch();
                    const textProps = innerRes?.props?.children?.[1]?.props;
                    if (!textProps?.style) return;
                    textProps.style.color = args?.member?.colorString || defaultTextColor();
                } catch {
                    // Leave the default voice row color.
                }
            });
        } catch {
            // Skip this voice row.
        }
    });
}
