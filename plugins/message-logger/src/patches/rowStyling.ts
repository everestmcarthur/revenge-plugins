import { ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByName } from "@shared/lib/rawFind";

const TAG = "[MessageLogger]";
const FAKE_DELETE_FLAG = "__msgLoggerDeleted";

function handleRow(row: any) {
    const message = row?.message;
    if (!message?.[FAKE_DELETE_FLAG]) return;

    message.edited = "deleted";
    message.textColor = ReactNative.processColor("#E4404380");
    row.backgroundHighlight ??= {};
    row.backgroundHighlight.backgroundColor = ReactNative.processColor("#da373c22");
    row.backgroundHighlight.gutterColor = ReactNative.processColor("#da373cff");
}

// Confirmed live: shared/lib/patchRows.ts's one-shot RowManager.prototype.generate lookup missed
// entirely - the method doesn't exist yet at plugin onLoad time (not registered until Discord's own
// code naturally requires that module), and a one-shot findByName never gets a second chance. Same
// class of bug RoleColorEverywhere's own patches/rows.ts already had to work around with a raw,
// uncached, retrying lookup instead of relying on the shared helper.
export function patchRowStyling(cleanups: (() => void)[]): boolean {
    const { NativeModules } = ReactNative;
    const DCDChatManager = NativeModules?.DCDChatManager;

    if (DCDChatManager?.updateRows) {
        cleanups.push(
            before("updateRows", DCDChatManager, (args: any[]) => {
                try {
                    const rows = JSON.parse(args[1]);
                    for (const row of rows) handleRow(row);
                    args[1] = JSON.stringify(rows);
                } catch {
                    // Leave args untouched - better to show unstyled rows than break message loading.
                }
            }),
        );
        return true;
    }

    const handle = waitFor(
        () => {
            const RowManager = rawFindByName<any>("RowManager");
            return RowManager?.prototype?.generate ? RowManager : undefined;
        },
        (RowManager) => {
            console.log(TAG, "DIAG: RowManager found, attempting patch");
            try {
                cleanups.push(after("generate", RowManager.prototype, (_args: any[], row: any) => {
                    try {
                        if (row?.message?.[FAKE_DELETE_FLAG]) console.log(TAG, "DIAG: handleRow saw flagged message", row.message.id);
                        handleRow(row);
                    } catch (e: any) { console.warn(TAG, "Row styling failed:", e?.message ?? e); }
                }));
                console.log(TAG, "DIAG: patch call completed without throwing");
            } catch (e: any) {
                console.warn(TAG, "DIAG: after() threw:", e?.message ?? e);
            }
        },
    );
    cleanups.push(() => handle.cancel());

    return true;
}
