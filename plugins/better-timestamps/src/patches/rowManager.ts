import { moment } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByName } from "@shared/lib/rawFind";
import renderTimestamp from "../lib/renderTimestamp";

function wrapTimestamp(original: any): any {
    const getFormatted = (..._args: any[]) => renderTimestamp(original);
    if (typeof Proxy === "undefined") return getFormatted();
    return new Proxy(original, {
        get(target, prop) {
            if (prop === "format" || prop === "calendar" || prop === "fromNow" || prop === "toISOString" || prop === "toString" || prop === "toJSON") {
                return getFormatted;
            }
            const value = target[prop];
            return typeof value === "function" ? value.bind(target) : value;
        }
    });
}

function parseTimestamp(value: any): any {
    if (value && typeof value.format === "function") return value;
    return moment(value);
}

// findByName caches a negative result permanently if it runs before RowManager registers -
// waitFor + a raw lookup retries until it's actually there.
export default function patchRowManager(): () => void {
    const patches: (() => void)[] = [];

    const handle = waitFor(
        () => {
            const RowManager = rawFindByName<any>("RowManager");
            return RowManager?.prototype?.generate ? RowManager : undefined;
        },
        (RowManager) => {
            patches.push(before("generate", RowManager.prototype, ([row]: any[]) => {
                try {
                    if (row.rowType === 1) {
                        if (storage.separateMessages) row.isFirst = true;
                        const parsed = parseTimestamp(row.message.timestamp);
                        row.message.__customTimestamp = wrapTimestamp(parsed);
                    } else if (row.rowType === "day") {
                        const parsed = moment(row.text, "LL");
                        if (storage.hideDateIfToday && parsed.isValid() && parsed.isSame(moment(), "day")) {
                            row.text = "Today";
                        } else {
                            row.text = renderTimestamp(parsed);
                        }
                    }
                } catch {
                    // Leave this row's timestamp untouched.
                }
            }));

            patches.push(after("generate", RowManager.prototype, ([row]: any[], result: any) => {
                try {
                    if (row.rowType !== 1) return;
                    if (row.message?.__customTimestamp && result?.message?.timestamp) {
                        result.message.timestamp = row.message.__customTimestamp;
                    }
                } catch {
                    // Leave the default timestamp.
                }
            }));
        }
    );

    return () => {
        handle.cancel();
        patches.forEach((p) => p());
    };
}
