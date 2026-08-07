import { React } from "@vendetta/metro/common";
import { rawFindAll, rawFindAllAsync } from "./rawFind";

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
 * Rewrites an element's props in place while keeping the same type - unlike registerPropsIntercept,
 * this doesn't swap in a different component, it lets the real one render with different input.
 *
 * Exists because monkey-patching a hook's exported property (`someModule.useSomeHook = wrapper`)
 * only affects callers that go through that exact exports-object reference. Confirmed live (Key
 * Inspector fiber capture) that Discord's Quest Dock hooks are called via an internal, same-chunk
 * closure reference instead - the patched export sits there unused, and the real, unpatched hook
 * result flows through untouched. A React.createElement/jsx call has no such ambiguity: it's always
 * the one shared runtime function, called the same way regardless of which chunk the JSX originated
 * in - so rewriting the `value` prop of a Context.Provider element here reaches every consumer
 * exactly as if the underlying hooks had actually returned that value.
 */
export function registerPropsTransform(predicate: (props: any) => boolean, transform: (props: any) => any) {
    propsTransforms.push({ predicate, transform });
}

/**
 * Purely observational: the first time an element is created whose `type` matches `predicate`,
 * calls `onDetected(type)` with the real, live type reference - it never alters what actually
 * renders (pair with registerIntercept/registerPropsIntercept in the callback for that).
 *
 * This exists for components that can't be found reliably by searching Metro's module registry
 * after the fact (findByTypeName/rawFindByTypeName), because that races against whenever the
 * component first mounts - if it mounts before the search finds it, and it never mounts again for
 * the rest of the session (true for some React.memo'd chrome components), the search losing that
 * race means the patch never gets a chance to apply at all, permanently. Intercepting element
 * creation instead sidesteps the race entirely: by the time ANYTHING calls createElement/jsx with
 * this component as `type`, that reference already exists and is already the real one about to be
 * used - there's no way to observe the call any earlier than this.
 *
 * `key` deduplicates registrations. index.ts retries any patch that hasn't landed yet every 200ms
 * for ~10s, and each of those retries used to append another copy of the same detector - up to ~50
 * duplicates per patch, every one of them re-tested against the `type` of every element created
 * anywhere in the app, during the exact window (cold boot) where the drawer is trying to appear
 * quickly. Registering under a key makes a retry a no-op instead.
 *
 * `persistent` (default false, one-shot): keeps watching and firing `onDetected` again for every
 * later match too, instead of stopping after the first. Needed when the component's own type
 * reference isn't a stable session-long singleton - confirmed live for GuildsBar, whose reference
 * changes on some navigation paths (e.g. switching servers via this plugin's own drawer), which a
 * one-shot detector plus registerIntercept's identity-keyed map can't follow: the intercept stays
 * registered for the old, now-abandoned reference while the new one renders unmodified.
 */
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
        if (!detector.persistent) consumed = true;
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

function makeWrapper(orig: Function, thisArg: any) {
    return function (this: any, type: any, props: any, ...rest: any[]) {
        const resolved = resolveReplacement(type, props, rest);
        if (resolved === null) return null;

        if (resolved) {
            const el = orig.call(thisArg ?? this, resolved.type, resolved.props ?? null, ...rest);
            if (resolved.collapse && resolved.collapse > 0 && el && typeof el === "object") {
                collapseMarks.set(el, resolved.collapse);
            }
            return el;
        }

        return orig.call(thisArg ?? this, type, props ?? null, ...rest);
    };
}

export function patchCreateElement(cleanups: (() => void)[]) {
    if (isPatched) return;

    const origCreateElement = React.createElement;
    if (!origCreateElement) {
        console.warn("[ServerDrawer] React.createElement is null, skipping patch");
        return;
    }

    const patchedCreateElement = makeWrapper(origCreateElement, React);
    Object.assign(patchedCreateElement, origCreateElement);
    React.createElement = patchedCreateElement as typeof React.createElement;
    isPatched = true;

    // Modern React/RN builds (Discord's included) compile JSX through the automatic runtime
    // (jsx/jsxs/jsxDEV from react/jsx-runtime) instead of React.createElement - patching only
    // createElement misses effectively every one of Discord's own render calls. Found by shape
    // (jsx/jsxs/Fragment together), not by name, for the same reason everything else in this file
    // avoids name-based lookups.
    //
    // Two changes over the previous version, both of which were causing the drawer to show up only
    // sometimes:
    //
    // 1. ALL matching runtime modules get patched, not just the first one rawFind returned. A
    //    bundle can hold more than one copy of the runtime, and any chunk importing a copy we
    //    didn't patch renders completely uninterceptable elements.
    // 2. The scan keeps running instead of stopping at the first success. Metro registers modules
    //    lazily, so a runtime copy belonging to a chunk that hasn't been required yet at boot
    //    simply does not exist to be found at that moment - the old one-shot waitFor resolved off
    //    the first copy and never looked again, permanently missing every copy registered later.
    const restoreJsx: (() => void)[] = [];
    const patchedRuntimes = new WeakSet<object>();
    let scanning = false;

    function patchRuntime(runtime: any) {
        if (patchedRuntimes.has(runtime)) return;
        patchedRuntimes.add(runtime);

        for (const key of ["jsx", "jsxs", "jsxDEV"] as const) {
            const orig = runtime[key];
            if (typeof orig !== "function") continue;

            runtime[key] = makeWrapper(orig, undefined);
            restoreJsx.push(() => { runtime[key] = orig; });
        }
    }

    // Patch any jsx runtimes already loaded before Discord's first render pass starts.
    // This is synchronous because the race we're fixing is specifically the first QuestDock render:
    // an async scan completes too late and the element is created through an unpatched runtime.
    const initialRuntimes = rawFindAll<any>(
        (m: any) => typeof m?.jsx === "function" || typeof m?.jsxs === "function" || typeof m?.jsxDEV === "function",
    );
    for (const runtime of initialRuntimes) {
        patchRuntime(runtime);
    }

    const scan = () => {
        if (scanning) return;
        scanning = true;

        rawFindAllAsync<any>(
            (m: any) => typeof m?.jsx === "function" || typeof m?.jsxs === "function" || typeof m?.jsxDEV === "function",
        ).then((runtimes) => {
            for (const runtime of runtimes) {
                patchRuntime(runtime);
            }
        }).catch((e: any) => {
            console.error("[ServerDrawer] rawFindAllAsync error", e);
        }).finally(() => {
            scanning = false;
        });
    };

    scan();

    // Fast while the app is still booting and chunks are being pulled in, then slow, then stop -
    // a full window.modules walk is not free and there's nothing left to catch once the UI has
    // settled.
    let ticks = 0;
    let timer: ReturnType<typeof setInterval> | undefined = setInterval(() => {
        scan();
        if (++ticks === 50 && timer) { // ~5s at 100ms
            clearInterval(timer);
            timer = setInterval(() => {
                scan();
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
        if (isPatched) {
            React.createElement = origCreateElement;
            isPatched = false;
        }
        restoreJsx.forEach((fn) => fn());
        restoreJsx.length = 0;
        intercepts.clear();
        propsIntercepts.length = 0;
        propsTransforms.length = 0;
        typeDetectors = [];
        detectorKeys.clear();
    });
}
