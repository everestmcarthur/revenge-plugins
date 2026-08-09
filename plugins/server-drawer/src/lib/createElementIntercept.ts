import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";

interface Intercept {
    replacement: React.ComponentType<any>;
    extraProps?: Record<string, any>;
    /**
     * How many ancestor levels above this element are allowed to be collapsed to zero size along
     * with it (0 = none). See `COLLAPSE_STYLE` below for why replacing a component with one that
     * renders nothing is, on its own, not enough to reclaim its space.
     */
    collapseAncestors?: number;
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
}

const intercepts = new Map<React.ComponentType<any>, Intercept>();
const propsIntercepts: PropsIntercept[] = [];
const propsTransforms: PropsTransform[] = [];
let typeDetectors: TypeDetector[] = [];
const detectorKeys = new Set<string>();
let isPatched = false;

/**
 * A React element created for something we're hiding, mapped to how many more ancestor levels may
 * still be collapsed with it. Elements are plain objects and are created child-first (a parent's
 * jsx() call can only run once its children exist), so a mark placed on a child is always already
 * present by the time the parent's own call is intercepted - which is what makes walking the
 * collapse *upward* possible at element-creation time at all.
 */
const collapseMarks = new WeakMap<object, number>();

/**
 * Zeroes an element out in every direction a parent could have sized it. `display: "none"` alone
 * is enough on Yoga, but the explicit width/flex zeroes also cover a container that sets its
 * child's size through a style array further up, and `overflow: hidden` stops anything absolutely
 * positioned inside from still painting.
 */
const COLLAPSE_STYLE = {
    display: "none" as const,
    width: 0,
    minWidth: 0,
    maxWidth: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    overflow: "hidden" as const,
};

export function registerIntercept(
    original: React.ComponentType<any>,
    replacement: React.ComponentType<any>,
    extraProps?: Record<string, any>,
    options?: { collapseAncestors?: number },
) {
    intercepts.set(original, { replacement, extraProps, collapseAncestors: options?.collapseAncestors });
}

// Same idea as registerIntercept, but matches on a predicate over the element's props instead of
// an exact type reference - useful when the component has no reliable name to find it by, but
// always passes some distinguishing prop. Pass replacement: null to render nothing instead.
export function registerPropsIntercept(predicate: (props: any) => boolean, replacement: React.ComponentType<any> | null) {
    propsIntercepts.push({ predicate, replacement });
}

// Rewrites an element's props in place, keeping the same type - unlike registerPropsIntercept,
// this doesn't swap in a different component, it just lets the real one render with different
// input. Exists because Quest Dock's hooks are called through a same-chunk closure reference, not
// the exported property - patching the export does nothing, but every element creation goes
// through this one shared path regardless of chunk, so there's no equivalent staleness here.
export function registerPropsTransform(predicate: (props: any) => boolean, transform: (props: any) => any) {
    propsTransforms.push({ predicate, transform });
}

// Purely observational: the first time an element is created whose type matches predicate, calls
// onDetected(type) with the live reference. Doesn't touch rendering - pair it with
// registerIntercept/registerPropsIntercept in the callback for that. Exists for components that
// aren't findable by searching Metro's registry after the fact (races against first mount).
//
// key dedupes registrations - index.ts retries every 200ms for ~10s, and duplicate detectors used
// to pile up, each re-tested against every element created anywhere in the app.
//
// persistent keeps the detector alive for every future match instead of firing once. GuildsBar's
// own type reference changes on some navigation paths (switching servers via this plugin's own
// drawer), so a one-shot detector would only ever catch the first, now-abandoned reference.
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

    // Only rebuild the list when a one-shot detector actually fired. The previous version rebuilt
    // it on every single element creation app-wide, forever, because the GuildsBar detector is
    // persistent and so the list is never empty - an allocation per element on the hottest path in
    // the entire app.
    if (consumed) {
        typeDetectors = typeDetectors.filter((d) => d.persistent || !d.justFired);
    }
}

// Marking is done out-of-band so the filter above stays a pure predicate.
declare module "./createElementIntercept" {}
interface TypeDetector { justFired?: boolean }

/**
 * Returns the collapse depth a parent element should inherit from its children, or 0 for "leave
 * this element alone."
 *
 * Returns the *maximum* collapse budget among real children. Previously this guarded against parents
 * with multiple children, but the live GuildsBar rail has sibling wrappers (avatar/dm tile) inside
 * the same outer container - the rail itself needs to be zeroed out too, and the replaced GuildsBar
 * child is the only collapsed one.
 */
function inspectCollapseChild(child: any): number {
    if (child == null || child === false || typeof child !== "object") return 0;
    return collapseMarks.get(child) ?? 0;
}

function inheritedCollapseDepth(props: any, rest: any[] = []): number {
    let deepest = 0;

    const children = props?.children;
    if (children != null) {
        if (Array.isArray(children)) {
            for (const child of children) deepest = Math.max(deepest, inspectCollapseChild(child));
        } else {
            deepest = Math.max(deepest, inspectCollapseChild(children));
        }
    }

    for (const child of rest) deepest = Math.max(deepest, inspectCollapseChild(child));
    return deepest;
}

/** Returns a replacement type if this element should be intercepted, `null` to render nothing, or `undefined` to pass through unchanged. */
function resolveReplacement(type: any, props: any, rest: any[]): { type: any; props: any; collapse?: number } | null | undefined {
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
        return {
            type: entry.replacement,
            props: entry.extraProps ? { ...effectiveProps, ...entry.extraProps } : effectiveProps,
            collapse: entry.collapseAncestors,
        };
    }

    // Nothing to swap here, but if this element's only child is one we've already collapsed, this
    // element is a wrapper that exists purely to hold it - zero it out too and pass the remaining
    // budget further up.
    const inherited = inheritedCollapseDepth(effectiveProps, rest);
    if (inherited > 0) {
        return {
            type,
            props: { ...effectiveProps, style: [effectiveProps?.style, COLLAPSE_STYLE] },
            collapse: inherited - 1,
        };
    }

    if (effectiveProps !== props) {
        return { type, props: effectiveProps };
    }

    return undefined;
}

// Mutates the already-created element in place rather than substituting args before creation -
// after() only sees the return value, not the call itself. A raw property reassignment on the
// jsx-runtime object (what this used to do) doesn't reliably reach real render calls here; after()
// does. Confirmed live: GuildsBar creations were observed firing through this exact patch point,
// but res.type never actually changed - the intercept logic was correct, the patch mechanism wasn't.
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
        if (resolved.collapse && resolved.collapse > 0) {
            collapseMarks.set(res, resolved.collapse);
        }
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
        console.warn("[ServerDrawer] React.createElement is null, skipping patch");
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

    // Fast while the app is still booting and chunks are being pulled in, then slow, then stop -
    // a full window.modules walk is not free and there's nothing left to catch once the UI has
    // settled.
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
