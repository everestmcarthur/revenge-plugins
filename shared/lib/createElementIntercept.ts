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

// Matches on a props predicate instead of an exact type reference, for components with no
// reliable name. Pass replacement: null to render nothing.
export function registerPropsIntercept(predicate: (props: any) => boolean, replacement: React.ComponentType<any> | null) {
    propsIntercepts.push({ predicate, replacement });
}

// Rewrites props in place, keeping the same type.
export function registerPropsTransform(predicate: (props: any) => boolean, transform: (props: any) => any) {
    propsTransforms.push({ predicate, transform });
}

// Fires onDetected(type) the first time a matching element is created. For components with no
// stable module export to search for after the fact. persistent keeps firing on every match
// instead of once, for references that change across navigation.
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
            // Ignore
        }
        if (!matched) continue;

        try {
            detector.onDetected(type);
        } catch {
            // Ignore
        }
        if (!detector.persistent) {
            detector.justFired = true;
            consumed = true;
        }
    }

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
                // Ignore
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
                // Ignore
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

// after() only sees the return value, not the call itself, so we mutate the element in place
// rather than substituting args beforehand.
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

    // Discord compiles JSX through jsx/jsxs/jsxDEV, not React.createElement - scan for those
    // runtimes by shape (names are mangled) and keep scanning since Metro registers lazily.
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
            // Ignore
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

    scanAndPatchJsxRuntimes();

    // Fast while the app boots, then slow, then stop.
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
