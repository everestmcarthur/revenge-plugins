import { ReactNative } from "@vendetta/metro/common";
import { before, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { findByProps, findByName } from "@vendetta/metro";
import { rawFind } from "@shared/lib/rawFind";
import { waitFor } from "@shared/lib/waitFor";
import type { AntiedStorage } from "../lib/types";

const toHex = (v: string | undefined, fallback: string) => {
    const s = String(v || "").trim();
    const hex = s.startsWith("#") ? s.slice(1) : s;
    return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : fallback;
};

function handleRow(row: any, deletedMessagesMap: Map<string, any>) {
    if (!row || row.type !== 1) return;
    const msg = row.message;
    if (!msg || (!deletedMessagesMap.has(msg.id) && !msg.was_deleted)) return;

    const cfg = storage as AntiedStorage;
    const {
        colors: { textColor, backgroundColor, backgroundColorAlpha, gutterColor, gutterColorAlpha },
        switches: { useBackgroundColor, minimalistic },
        inputs: { deletedMessageBuffer },
    } = cfg;

    msg.edited = deletedMessageBuffer || "This message is deleted";

    if (!minimalistic) {
        msg.textColor = ReactNative.processColor(toHex(textColor, "#E40303"));
    }

    if (!minimalistic && useBackgroundColor) {
        row.backgroundHighlight = {
            backgroundColor: ReactNative.processColor(toHex(backgroundColor, "#FF2C2F") + backgroundColorAlpha),
            gutterColor: ReactNative.processColor(toHex(gutterColor, "#FF2C2F") + gutterColorAlpha),
        };
    }
}

function isNativeUpdateRows(m: any): boolean {
    return typeof m?.updateRows === "function" && m.updateRows.toString().includes("[native code]");
}

export function patchUpdateRows(deletedMessagesMap: Map<string, any>, isEnabledRef: { current: boolean }): () => void {
    const cleanups: (() => void)[] = [];

    const applyHook = (target: any) => {
        cleanups.push(
            before("updateRows", target, (args: any[]) => {
                if (!isEnabledRef.current || !args?.length) return;
                if (!deletedMessagesMap.size) return;

                const raw = args[1];
                if (!raw) return;

                if (typeof raw === "string") {
                    try {
                        const rows = JSON.parse(raw);
                        let mutated = false;
                        for (const row of rows) {
                            if (row?.type === 1 && row?.message && (deletedMessagesMap.has(row.message.id) || row.message.was_deleted)) {
                                handleRow(row, deletedMessagesMap);
                                mutated = true;
                            }
                        }
                        if (mutated) {
                            args[1] = JSON.stringify(rows);
                            return args;
                        }
                    } catch {
                        return;
                    }
                } else if (Array.isArray(raw)) {
                    for (const row of raw) handleRow(row, deletedMessagesMap);
                } else if (raw && typeof raw === "object" && Array.isArray(raw.rows)) {
                    for (const row of raw.rows) handleRow(row, deletedMessagesMap);
                }
            })
        );
    };

    const { NativeModules } = ReactNative;
    const DCDChatManager = NativeModules?.DCDChatManager;
    if (DCDChatManager?.updateRows) {
        applyHook(DCDChatManager);
    }

    const nativeChat = rawFind<any>(isNativeUpdateRows) || findByProps("updateRows", "getConstants") || findByProps("updateRows");
    if (nativeChat && nativeChat !== DCDChatManager) {
        applyHook(nativeChat);
    } else if (!DCDChatManager) {
        const handle = waitFor(
            () => rawFind<any>(isNativeUpdateRows) || findByProps("updateRows"),
            (target) => applyHook(target)
        );
        cleanups.push(() => handle.cancel());
    }

    const RowManager = findByName("RowManager", false) || findByProps("RowManager")?.RowManager;
    if (RowManager?.prototype?.generate) {
        cleanups.push(
            after("generate", RowManager.prototype, (_args: any[], rowObj: any) => {
                if (!isEnabledRef.current || !deletedMessagesMap.size) return;
                const row = rowObj?.row || rowObj;
                handleRow(row, deletedMessagesMap);
            })
        );
    }

    return () => {
        for (const fn of cleanups) fn();
    };
}
