import { React } from "@vendetta/metro/common";
import { rawFind } from "./rawFind";
import { waitFor } from "./waitFor";

interface Intercept {
    replacement: React.ComponentType<any>;
    extraProps?: Record<string, any>;
}

interface PropsIntercept {
    predicate: (props: any) => boolean;
    replacement: React.ComponentType<any> | null;
}

interface TypeDetector {
    predicate: (type: any) => boolean;
    onDetected: (type: any) => void;
}

const intercepts = new Map<React.ComponentType<any>, Intercept>();
const propsIntercepts: PropsIntercept[] = [];
let typeDetectors: TypeDetector[] = [];
let isPatched = false;

export function registerIntercept(
    original: React.ComponentType<any>,
    replacement: React.ComponentType<any>,
    extraProps?: Record<string, any>,
) {
    intercepts.set(original, { replacement, extraProps });
}

/**
 * Same idea as registerIntercept, but matches by a predicate over the element's props instead of
 * an exact type reference - useful when the component itself has no reliable name to find it by
 * (no named export, and a stripped/mangled runtime function name), but it always passes some
 * distinguishing literal prop (e.g. a nativeID) that survives into the compiled bundle unchanged.
 * Pass `replacement: null` to render nothing at all instead of swapping in a component.
 */
export function registerPropsIntercept(predicate: (props: any) => boolean, replacement: React.ComponentType<any> | null) {
    propsIntercepts.push({ predicate, replacement });
}

/**
 * Purely observational, one-shot: the first time an element is created whose `type` matches
 * `predicate`, calls `onDetected(type)` with the real, live type reference and then stops
 * watching - it never alters what actually renders.
 *
 * This exists for components that can't be found reliably by searching Metro's module registry
 * after the fact (findByTypeName/rawFindByTypeName), because that races against whenever the
 * component first mounts - if it mounts before the search finds it, and it never mounts again for
 * the rest of the session (true for some React.memo'd chrome components), the search losing that
 * race means the patch never gets a chance to apply at all, permanently. Intercepting element
 * creation instead sidesteps the race entirely: by the time ANYTHING calls createElement/jsx with
 * this component as `type`, that reference already exists and is already the real one about to be
 * used - there's no way to observe the call any earlier than this.
 */
export function registerTypeDetector(predicate: (type: any) => boolean, onDetected: (type: any) => void) {
    typeDetectors.push({ predicate, onDetected });
}

function runTypeDetectors(type: any) {
    if (typeDetectors.length === 0) return;
    const remaining: TypeDetector[] = [];
    for (const detector of typeDetectors) {
        let matched = false;
        try {
            matched = detector.predicate(type);
        } catch {
            // A bad predicate shouldn't block every other detector or every element from rendering.
        }
        if (matched) {
            try {
                detector.onDetected(type);
            } catch {
                // Same - a detector's own handler throwing shouldn't take anything else down.
            }
        } else {
            remaining.push(detector);
        }
    }
    typeDetectors = remaining;
}

/** Returns a replacement type if this element should be intercepted, `null` to render nothing, or `undefined` to pass through unchanged. */
function resolveReplacement(type: any, props: any): { type: any; props: any } | null | undefined {
    runTypeDetectors(type);

    if (props) {
        for (const { predicate, replacement } of propsIntercepts) {
            try {
                if (predicate(props)) {
                    return replacement ? { type: replacement, props } : null;
                }
            } catch {
                // A bad predicate shouldn't block every other element from rendering.
            }
        }
    }

    const entry = intercepts.get(type);
    if (entry) {
        return { type: entry.replacement, props: entry.extraProps ? { ...props, ...entry.extraProps } : props };
    }

    return undefined;
}

export function patchCreateElement(cleanups: (() => void)[]) {
    if (isPatched) return;

    const origCreateElement = React.createElement;
    if (!origCreateElement) {
        console.warn("[ServerDrawer] React.createElement is null, skipping patch");
        return;
    }

    const patchedCreateElement = function (type: any, props: any, ...rest: any[]) {
        const resolved = resolveReplacement(type, props);
        if (resolved === null) return null;
        if (resolved) return origCreateElement.call(React, resolved.type, resolved.props, ...rest);
        return origCreateElement.call(React, type, props, ...rest);
    };

    Object.assign(patchedCreateElement, origCreateElement);
    React.createElement = patchedCreateElement as typeof React.createElement;
    isPatched = true;

    // Modern React/RN builds (Discord's included) compile JSX through the automatic runtime
    // (jsx/jsxs from react/jsx-runtime) instead of React.createElement - patching only
    // createElement misses every one of Discord's own render calls entirely. Found by shape
    // (jsx/jsxs/Fragment together), not by name, for the same reason everything else in this file
    // avoids name-based lookups.
    //
    // The jsx-runtime lookup is retried (not a single one-shot rawFind) because if that module
    // hasn't been required yet at the exact moment this runs - very early in boot, when a plugin's
    // onLoad first calls this - jsx/jsxs would never get patched for the rest of the session at
    // all, silently. Since Discord renders almost everything through jsx/jsxs and not
    // createElement, that would make every registerTypeDetector/registerPropsIntercept consumer's
    // patch a near-total no-op whenever that race was lost.
    const restoreJsx: (() => void)[] = [];
    const jsxHandle = waitFor(
        () => rawFind((m: any) => typeof m?.jsx === "function" && typeof m?.jsxs === "function" && "Fragment" in m),
        (jsxRuntime: any) => {
            for (const key of ["jsx", "jsxs"] as const) {
                const orig = jsxRuntime[key];
                if (typeof orig !== "function") continue;

                jsxRuntime[key] = function (type: any, props: any, ...rest: any[]) {
                    const resolved = resolveReplacement(type, props);
                    if (resolved === null) return null;
                    if (resolved) return orig.call(this, resolved.type, resolved.props, ...rest);
                    return orig.call(this, type, props, ...rest);
                };
                restoreJsx.push(() => { jsxRuntime[key] = orig; });
            }
        }
    );

    cleanups.push(() => {
        jsxHandle.cancel();
        if (isPatched) {
            React.createElement = origCreateElement;
            isPatched = false;
        }
        restoreJsx.forEach((fn) => fn());
        intercepts.clear();
        propsIntercepts.length = 0;
        typeDetectors = [];
    });
}
