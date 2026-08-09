import { findByName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { defaultTextColor } from "../lib/color";

export default function patchVoiceUserConnected(): () => void {
    const VoiceUserConnected = findByName("VoiceUserConnected", false);
    if (!VoiceUserConnected) return () => {};

    return after("default", VoiceUserConnected, ([args]: any[], res: any) => {
        try {
            if (storage.noVoice || !res?.type) return;

            const unpatch = after("type", res.type, (_: any, innerRes: any) => {
                try {
                    unpatch();
                    const nameItem = findInReactTree(innerRes, (n: any) => n?.type?.name === "VoiceUserNameItem");
                    if (!nameItem?.props) return;
                    nameItem.props.color = args?.member?.colorString || defaultTextColor();
                } catch {
                    // Leave the default voice row color.
                }
            });
        } catch {
            // Skip this voice row.
        }
    });
}
