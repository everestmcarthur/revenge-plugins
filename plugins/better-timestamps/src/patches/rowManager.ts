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
            if (prop === "format" || prop === "calendar" || prop === "fromNow" || prop === "toISOString" || prop === "toString") {
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

// RowManager used to be looked up eagerly at module-import time with the cached findByName - a
// plugin's top-level code runs as soon as Discord requires its bundle, which can be before Discord's
// own code has required RowManager itself, and Revenge's findByName permanently caches a negative
// result. Confirmed live via Key Inspector's Eval console: a raw, uncached scan found
// RowManager.prototype.generate present and correct once the module had actually initialized - the
// class itself was never the problem, just the timing of a one-shot lookup racing it.
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
                        row.text = renderTimestamp(moment(row.text, "LL"));
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
