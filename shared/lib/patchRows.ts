import { findByName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";

export type RowHandler = (rows: any[]) => void;

/**
 * Chat rows are rendered natively - message data crosses the JS/native bridge as JSON via
 * DCDChatManager.updateRows on newer builds, or via RowManager.generate (one row per call) on
 * older ones. This runs `handler` against the row array either way, so callers don't have to
 * reimplement the bridge-vs-RowManager fallback themselves.
 */
export function patchRows(handler: RowHandler): () => void {
    const { NativeModules } = ReactNative;
    const DCDChatManager = NativeModules?.DCDChatManager;

    if (DCDChatManager?.updateRows) {
        return before("updateRows", DCDChatManager, (args: any[]) => {
            try {
                const rows = JSON.parse(args[1]);
                handler(rows);
                args[1] = JSON.stringify(rows);
            } catch {
                // Leave args untouched - better to skip the transform than break message loading.
            }
        });
    }

    const RowManager = findByName("RowManager", false);
    if (RowManager?.prototype?.generate) {
        return after("generate", RowManager.prototype, (_args: any[], row: any) => {
            try {
                handler([row]);
            } catch {
                // Skip this row.
            }
        });
    }

    return () => {};
}
