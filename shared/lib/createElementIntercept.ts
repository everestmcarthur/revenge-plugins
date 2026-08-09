import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";

interface Intercept {
    replacement: React.ComponentType<any>;
    extraProps?: Record<string, any>;
}

interface PropsIntercept {
    predicate: (props: any) => boolean;
    replacement: React.ComponentType<any> | null;
}

interface PropsTransform {
    predicate: (props: any) => boolean;
    transform: (props: any) => any;
}

interface TypeDetector {
    key: string;
    predicate: (type: any) => boolean;
    onDetected: (type: any) => void;
    persistent: boolean;
    justFired?: boolean;
}

const intercepts = new Map<React.ComponentType<any>, Intercept>();
const propsIntercepts: PropsIntercept[] = [];
const propsTransforms: PropsTransform[] = [];
let typeDetectors: TypeDetector[] = [];
const detectorKeys = new Set<string>();
let isPatched = false;

export function registerIntercept(
    original: React.ComponentType<any>,
    replacement: React.ComponentType<any>,
    extraProps?: Record<string, any>,
) {
    intercepts.set(original, { replacement, extraProps });
}

// Same idea as registerIntercept, but matches on a predicate over the element's props instead of
// an exact type reference - useful when the component has no reliable name to find it by, but
// always passes some distinguishing prop. Pass replacement: null to render nothing instead.
export function registerPropsIntercept(predicate: (props: any) => boolean, replacement: React.ComponentType<any> | null) {
    propsIntercepts.push({ predicate, replacement });
}

// Rewrites an element's props in place, keeping the same type - unlike registerPropsIntercept,
// this doesn't swap in a different component, it just lets the real one render with different
// input. Useful where patching a hook's exported property wouldn't work (same-chunk closures
// often bypass the export entirely); every element creation goes through this one shared path
// regardless of which chunk it came from, so there's no equivalent staleness problem here.
export function registerPropsTransform(predicate: (props: any) => boolean, transform: (props: any) => any) {
    propsTransforms.push({ predicate, transform });
}

// Purely observational: the first time an element is created whose type matches predicate, calls
// onDetected(type) with the live reference. Doesn't touch rendering itself - pair it with
// registerIntercept/registerPropsIntercept in the callback for that. This is how you find a
// component that isn't a top-level module export and can't be searched for after the fact.
//
// key dedupes registrations (matters if the call site can run more than once, e.g. a retry loop).
// persistent keeps the detector alive for every future match instead of firing once and dropping
// - needed for components whose reference isn't stable for the whole session.
export function registerTypeDetector(
    key: string,
    predicate: (type: any) => boolean,
    onDetected: (type: any) => void,
    options?: { persistent?: boolean },
) {
    if (detectorKeys.has(key)) return;
    detectorKeys.add(key);
    typeDetectors.push({ key, predicate, onDetected, persistent: options?.persistent ?? false });
}

export function hasTypeDetector(key: string): boolean {
    return detectorKeys.has(key);
}

function runTypeDetectors(type: any) {
    if (typeDetectors.length === 0) return;

    let consumed = false;
    for (const detector of typeDetectors) {
        let matched = false;
        try {
            matched = detector.predicate(type);
        } catch {
            // A bad predicate shouldn't block every other detector or every element from rendering.
        }
        if (!matched) continue;

        try {
            detector.onDetected(type);
        } catch {
            // Same - a detector's own handler throwing shouldn't take anything else down.
        }
        if (!detector.persistent) {
            detector.justFired = true;
            consumed = true;
        }
    }

    // Only rebuild the list when a one-shot detector actually fired - rebuilding on every single
    // element creation app-wide would be an allocation per element on the hottest path in the app
    // whenever any persistent detector is registered (the list is then never empty).
    if (consumed) {
        typeDetectors = typeDetectors.filter((d) => d.persistent || !d.justFired);
    }
}

/** Returns a replacement type if this element should be intercepted, `null` to render nothing, or `undefined` to pass through unchanged. */
function resolveReplacement(type: any, props: any, rest: any[]): { type: any; props: any } | null | undefined {
    runTypeDetectors(type);

    let effectiveProps = props;
    if (effectiveProps) {
        for (const { predicate, transform } of propsTransforms) {
            try {
                if (predicate(effectiveProps, type, rest)) {
                    effectiveProps = transform(effectiveProps);
                }
            } catch {
                // A bad transform shouldn't block every other element from rendering.
            }
        }
    }

    if (effectiveProps) {
        for (const { predicate, replacement } of propsIntercepts) {
            try {
                if (predicate(effectiveProps, type, rest)) {
                    return replacement ? { type: replacement, props: effectiveProps } : null;
                }
            } catch {
                // A bad predicate shouldn't block every other element from rendering.
            }
        }
    }

    const entry = intercepts.get(type);
    if (entry) {
        return { type: entry.replacement, props: entry.extraProps ? { ...effectiveProps, ...entry.extraProps } : effectiveProps };
    }

    if (effectiveProps !== props) {
        return { type, props: effectiveProps };
    }

    return undefined;
}

// Mutates the already-created element in place rather than substituting args before creation.
// This has to go through @vendetta/patcher's after() instead of a raw property reassignment on
// the jsx-runtime object - a plain reassignment (what this file and server-drawer's copy used to
// do) just doesn't reach real render calls here, after() does. Since after() only sees the return
// value, not the original call, we mutate res.type/res.props after the fact instead of swapping
// the type beforehand - same result, React just reads whatever's on the object it gets handed.
function applyResolved(res: any, type: any, props: any, rest: any[]) {
    if (!res || typeof res !== "object") return res;
    const resolved = resolveReplacement(type, props, rest);
    if (resolved === null) {
        res.type = () => null;
        return res;
    }
    if (resolved) {
        res.type = resolved.type;
        res.props = resolved.props ?? null;
    }
    return res;
}

export function patchCreateElement(cleanups: (() => void)[]) {
    if (isPatched) return;
    isPatched = true;

    if (React.createElement) {
        cleanups.push(
            after("createElement", React, (args: any[], res: any) => applyResolved(res, args[0], args[1], args.slice(2)))
        );
    } else {
        console.warn("[createElementIntercept] React.createElement is null, skipping patch");
    }

    // Discord's bundle compiles JSX through the automatic runtime (jsx/jsxs/jsxDEV) instead of
    // React.createElement, so patching createElement alone misses nearly everything. We scan for
    // the runtime by shape rather than name since names get mangled, patch every copy we find (a
    // bundle can have more than one), and keep scanning on an interval since Metro registers
    // modules lazily - a copy that hasn't been required yet at boot just isn't there to find.
    const patchedJsxRuntimes = new WeakSet<any>();

    function isJsxRuntime(m: any): boolean {
        return typeof m?.jsx === "function" || typeof m?.jsxs === "function" || typeof m?.jsxDEV === "function";
    }

    function patchJsxObject(runtime: any) {
        if (patchedJsxRuntimes.has(runtime)) return;
        patchedJsxRuntimes.add(runtime);
        for (const key of ["jsx", "jsxs", "jsxDEV"] as const) {
            if (typeof runtime[key] !== "function") continue;
            cleanups.push(
                after(key, runtime, (args: any[], res: any) => applyResolved(res, args[0], args[1], args.slice(2)))
            );
        }
    }

    function patchJsxModule(def: any) {
        if (!def?.publicModule?.exports) return;
        const exports = def.publicModule.exports;

        try {
            if (isJsxRuntime(exports)) patchJsxObject(exports);

            const dflt = exports.default;
            if (dflt != null && isJsxRuntime(dflt)) patchJsxObject(dflt);
        } catch {
            // Ignore one module's bad shape and continue scanning.
        }
    }

    function scanAndPatchJsxRuntimes() {
        const modules = (window as any)?.modules;
        if (!modules) return;
        for (const id in modules) {
            const def = modules[id];
            if (!def?.isInitialized) continue;
            patchJsxModule(def);
        }
    }

    // Patch any jsx runtimes already loaded before Discord's first render pass starts, synchronously
    // - an async scan would complete too late for the very first render of an early-mounting target.
    scanAndPatchJsxRuntimes();

    // Fast while the app is still booting and chunks are being pulled in, then slow, then stop - a
    // full window.modules walk is not free and there's nothing left to catch once the UI has settled.
    let ticks = 0;
    let timer: ReturnType<typeof setInterval> | undefined = setInterval(() => {
        scanAndPatchJsxRuntimes();
        if (++ticks === 50 && timer) { // ~5s at 100ms
            clearInterval(timer);
            timer = setInterval(() => {
                scanAndPatchJsxRuntimes();
                if (++ticks >= 75 && timer) { // + ~25s at 1s
                    clearInterval(timer);
                    timer = undefined;
                }
            }, 1000);
        }
    }, 100);

    cleanups.push(() => {
        if (timer) clearInterval(timer);
        timer = undefined;
        isPatched = false;
        intercepts.clear();
        propsIntercepts.length = 0;
        propsTransforms.length = 0;
        typeDetectors = [];
        detectorKeys.clear();
    });
}
