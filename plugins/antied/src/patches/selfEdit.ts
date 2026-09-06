import { before } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { regexEscaper } from "./actionSheet";
import type { AntiedStorage } from "../lib/types";

const Message = findByProps("sendMessage", "startEditMessage");

export function patchSelfEdit(isEnabledRef: { current: boolean }): () => void {
    if (!Message?.startEditMessage) return () => {};

    return before("startEditMessage", Message, (args: any[]) => {
        if (!isEnabledRef.current || !args?.length) return;

        const cfg = storage as AntiedStorage;
        const edited = cfg.inputs?.editedMessageBuffer || "`[ EDITED ]`";
        const dan = regexEscaper(edited);

        const regexPattern = new RegExp(
            `(?:(?:\\s${dan}(\\s\\(<t:\\d+:[tTdDfFR]>\\))?\\n{2})|(?:(?:\\s\\(<t:\\d+:[tTdDfFR]>\\) ${dan}\\n{2})))`,
            "gm"
        );

        const msg = args[2];
        if (typeof msg === "string") {
            const lats = msg.split(regexPattern);
            args[2] = lats[lats.length - 1];
        }
    });
}
