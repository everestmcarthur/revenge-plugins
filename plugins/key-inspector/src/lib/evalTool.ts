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

// Android/iOS keyboards commonly have "smart punctuation" that silently swaps straight quotes for
// curly ones as you type - that turns "foo" into “foo”, a different character to the JS parser.
// Harmless to keep normalizing even though it turned out not to be the actual cause of the errors
// seen while building this (see below) - cheap, and still a real footgun on its own.
function normalizeSmartPunctuation(code: string): string {
    return code
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-");
}

/**
 * Runs arbitrary code typed into the Eval box, with this repo's own lookup helpers already in
 * scope - built so an on-device assumption behind a fix (does this property exist, does this call
 * behave the way decompiled source suggested) can be checked in seconds instead of a full
 * build/push/update/test cycle.
 *
 * The dynamically-compiled function body is deliberately NOT `async`. Hermes (RN's JS engine)
 * precompiles the whole app bundle to bytecode ahead of time, and its runtime `eval`/`new Function`
 * path only supports a reduced subset of the language - confirmed on-device that it rejects `async`
 * functions outright ("async functions are unsupported"), even though normal precompiled code
 * (including this very function) uses async/await freely. So the user's code runs as a plain
 * synchronous function; if it needs to do something timed/async, it returns a Promise itself
 * (`return new Promise(resolve => setTimeout(() => resolve(x), 1000))` works fine - only the
 * `async`/`await` *keywords* are the problem, not Promises as a runtime object) and this function
 * awaits that result out here, in precompiled code where await is fully supported.
 */
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
