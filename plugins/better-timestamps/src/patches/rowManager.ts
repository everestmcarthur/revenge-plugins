import { findByName } from "@vendetta/metro";
import { moment } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import renderTimestamp from "../lib/renderTimestamp";

const RowManager = findByName("RowManager", false);

export default function patchRowManager(): () => void {
    if (!RowManager?.prototype?.generate) return () => {};

    const patches: (() => void)[] = [];

    patches.push(before("generate", RowManager.prototype, ([row]: any[]) => {
        try {
            if (row.rowType === 1) {
                if (storage.separateMessages) row.isFirst = true;
                row.message.__customTimestamp = renderTimestamp(row.message.timestamp);
            } else if (row.rowType === "day") {
                row.text = renderTimestamp(moment(row.text, "LL"));
            }
        } catch {
            // Leave this row's timestamp untouched.
        }
    }));

    patches.push(after("generate", RowManager.prototype, ([row]: any[], result: any) => {
        try {
            if (row.rowType !== 1) return;
            if (row.message?.__customTimestamp && result?.message?.state === "SENT" && result.message.timestamp) {
                result.message.timestamp = row.message.__customTimestamp;
            }
        } catch {
            // Leave the default timestamp.
        }
    }));

    return () => patches.forEach((p) => p());
}
