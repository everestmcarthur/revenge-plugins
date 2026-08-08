import { moment } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { waitFor } from "@shared/lib/waitFor";
import { rawFind } from "@shared/lib/rawFind";
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

function findTimestampModule(): any {
    return rawFind<any>((m) => {
        if (typeof m !== "object" || m == null) return false;
        return Object.values(m).some((v: any) => {
            if (typeof v === "string") return v.includes("MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL");
            if (typeof v === "function") {
                const s = v.toString();
                return s.includes("MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL") || s.includes("MESSAGE_CREATED_TIMESTAMP_A11Y_LABEL");
            }
            return false;
        });
    });
}

export default function patchTimestamp(): () => void {
    const patches: (() => void)[] = [];

    const handle = waitFor(
        () => {
            const module = findTimestampModule();
            return module?.default ? module : undefined;
        },
        (module) => {
            patches.push(before("default", module, ([props]: any[]) => {
                try {
                    if (props?.timestamp != null) {
                        const parsed = parseTimestamp(props.timestamp);
                        props.timestamp = wrapTimestamp(parsed);
                    }
                    if (props?.editedTimestamp != null) {
                        const parsed = parseTimestamp(props.editedTimestamp);
                        props.editedTimestamp = wrapTimestamp(parsed);
                    }
                } catch {
                    // Leave timestamps untouched.
                }
            }));
        }
    );

    return () => {
        handle.cancel();
        patches.forEach((p) => p());
    };
}
