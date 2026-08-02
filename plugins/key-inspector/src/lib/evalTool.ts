import { findByProps, findByName, find } from "@vendetta/metro";
import { React, ReactNative, FluxDispatcher } from "@vendetta/metro/common";
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

/**
 * Runs arbitrary code typed into the Eval box, with this repo's own lookup helpers already in
 * scope - built so an on-device assumption behind a fix (does this property exist, does this call
 * behave the way decompiled source suggested) can be checked in seconds instead of a full
 * build/push/update/test cycle. The code runs as the body of an async function, so a bare
 * expression, a `return ...`, or `await`-ing something all work. Never runs anything on its own -
 * only what's typed in and manually run here.
 */
export async function runEval(code: string): Promise<string> {
    try {
        const fn = new Function(
            "findByProps",
            "findByName",
            "find",
            "rawFind",
            "rawFindByTypeName",
            "rawFindByProps",
            "rawFindByName",
            "rawFindByStoreName",
            "React",
            "ReactNative",
            "FluxDispatcher",
            "window",
            `return (async () => {\n${code}\n})();`
        );

        const result = await fn(
            findByProps,
            findByName,
            find,
            rawFind,
            rawFindByTypeName,
            rawFindByProps,
            rawFindByName,
            rawFindByStoreName,
            React,
            ReactNative,
            FluxDispatcher,
            window
        );

        return safeStringify(result);
    } catch (e) {
        return `Error: ${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`;
    }
}
