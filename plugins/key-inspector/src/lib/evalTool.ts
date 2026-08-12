import { findByProps, findByName, findByTypeName, findByStoreName, findByPropsAll, findByNameAll, find } from "@vendetta/metro";
import { React, ReactNative, FluxDispatcher } from "@vendetta/metro/common";
import { instead, before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { rawFind, rawFindByTypeName, rawFindByProps, rawFindByName, rawFindByStoreName } from "@shared/lib/rawFind";

declare const window: any;

function safeStringify(value: any): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
    if (typeof value !== "object") return String(value);

    const seen = new WeakSet();
    try {
        return JSON.stringify(
            value,
            (_key, val) => {
                if (typeof val === "function") return `[Function: ${val.name || "anonymous"}]`;
                if (typeof val === "symbol") return val.toString();
                if (typeof val === "object" && val !== null) {
                    if (seen.has(val)) return "[Circular]";
                    seen.add(val);
                }
                return val;
            },
            2
        );
    } catch {
        // Most live Discord/React objects (fibers, class instances, refs) have circular structure
        // or getters that throw - falling back to a flat key listing still tells you something
        // useful instead of just "[object Object]".
        try {
            return `[unserializable object, keys: ${Object.keys(value).join(", ")}]`;
        } catch (e) {
            return `[unserializable, and Object.keys threw: ${e}]`;
        }
    }
}

// Mobile keyboards commonly swap straight quotes for curly ones while typing, which is a
// different character to the JS parser.
function normalizeSmartPunctuation(code: string): string {
    return code
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-");
}

// Runs arbitrary code typed into the Eval box, with this repo's own lookup helpers in scope. The
// compiled function body is deliberately NOT async - Hermes's runtime eval/new Function path
// rejects the async keyword outright, so the code runs as a plain sync function and returns a
// Promise itself if it needs to do something timed, which this function awaits out here instead.
export async function runEval(rawCode: string): Promise<string> {
    const code = normalizeSmartPunctuation(rawCode);
    try {
        const fn = new Function(
            "findByProps",
            "findByName",
            "findByTypeName",
            "findByStoreName",
            "findByPropsAll",
            "findByNameAll",
            "find",
            "rawFind",
            "rawFindByTypeName",
            "rawFindByProps",
            "rawFindByName",
            "rawFindByStoreName",
            "instead",
            "before",
            "after",
            "getAssetIDByName",
            "showToast",
            "React",
            "ReactNative",
            "FluxDispatcher",
            "window",
            `return (function() {\n${code}\n})();`
        );

        const result = fn(
            findByProps,
            findByName,
            findByTypeName,
            findByStoreName,
            findByPropsAll,
            findByNameAll,
            find,
            rawFind,
            rawFindByTypeName,
            rawFindByProps,
            rawFindByName,
            rawFindByStoreName,
            instead,
            before,
            after,
            getAssetIDByName,
            showToast,
            React,
            ReactNative,
            FluxDispatcher,
            window
        );

        const resolved = result && typeof result.then === "function" ? await result : result;
        return safeStringify(resolved);
    } catch (e) {
        return `Error: ${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`;
    }
}
