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
 * only affects callers that go through that exact exports-object reference. Discord's own hooks are
 * often called via an internal, same-chunk closure reference instead - the patched export sits there
 * unused, and the real, unpatched hook result flows through untouched. A React.createElement/jsx call
 * has no such ambiguity: it's always the one shared runtime function, called the same way regardless
 * of which chunk the JSX originated in - so rewriting an element's props here reaches every consumer
 * exactly as if the underlying data had actually been different.
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
 * the rest of the session (true for some React.memo'd chrome components, and for inner components
 * only reachable by rendering an outer one first), the search losing that race means the patch never
 * gets a chance to apply at all, permanently. Intercepting element creation instead sidesteps the
 * race entirely: by the time ANYTHING calls createElement/jsx with this component as `type`, that
 * reference already exists and is already the real one about to be used - there's no way to observe
 * the call any earlier than this.
 *
 * `key` deduplicates registrations - important if the call site that registers a detector can run
 * more than once (a retry loop, a patch that reapplies on reload), since duplicate detectors mean
 * duplicate `onDetected` firings and a permanently growing list re-tested against every element
 * created anywhere in the app.
 *
 * `persistent` (default false, one-shot): keeps watching and firing `onDetected` again for every
 * later match too, instead of stopping after the first. Needed when the component's own type
 * reference isn't a stable session-long singleton (confirmed live for some chrome components, whose
 * reference changes on certain navigation paths) - a one-shot detector plus registerIntercept's
 * identity-keyed map can't follow that: the intercept stays registered for the old, now-abandoned
 * reference while the new one renders unmodified.
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

/**
 * Applies a resolved replacement to an already-created element in place, mutating `res` rather
 * than substituting arguments before creation.
 *
 * This patches with `@vendetta/patcher`'s `after()` - the same mechanism proven reliable
 * throughout this repo for every other patch - rather than raw property reassignment
 * (`runtime.jsx = wrapper`). Confirmed live (see /root/evals-for-rn) that raw reassignment on the
 * jsx-runtime module's `jsx`/`jsxs` properties does *not* reliably reach real render calls on this
 * client: after mutating the property directly, a diagnostic hook wrapped the *same* object with
 * `vendetta.patcher.after` and correctly observed real calls, while a diagnostic that only
 * reassigned the property directly (mirroring what this file used to do, and what
 * `server-drawer`'s otherwise more battle-tested copy still does) never fired at all for the same
 * real calls. `after()` clearly does something a plain reassignment doesn't to actually reach
 * consumers - since `React.createElement`/`jsx`/`jsxs` are always looked up fresh through the one
 * shared runtime function (not destructured into a same-chunk closure the way some of Discord's
 * own hooks are, per this repo's other same-chunk-staleness notes), the difference isn't about
 * reaching a stale binding - it's specifically that `after()`'s patching mechanism is what
 * actually gets observed, and a bare property set on the exports object is not, for reasons this
 * investigation didn't need to fully explain to fix: use the mechanism proven to work.
 *
 * Because `after()` fires once the real function has already run and produced `res`, replacing
 * the *type* (registerIntercept/registerPropsIntercept) is expressed by mutating `res.type`/
 * `res.props` after the fact rather than by substituting arguments beforehand - React reads
 * `.type`/`.props` off whatever object it's handed for reconciliation regardless of how those
 * fields were set, so this has the same practical effect (confirmed live).
 */
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

    // Modern React/RN builds (Discord's included) compile JSX through the automatic runtime
    // (jsx/jsxs/jsxDEV from react/jsx-runtime) instead of React.createElement - patching only
    // createElement misses effectively every one of Discord's own render calls. Found by shape
    // (jsx/jsxs/jsxDEV together), not by name, since runtime function names get mangled/stripped.
    //
    // ALL matching runtime modules get patched, not just the first one found, and the scan keeps
    // running instead of stopping at the first success: a bundle can hold more than one copy of the
    // runtime (different chunks importing different copies), and Metro registers modules lazily, so
    // a copy belonging to a chunk that hasn't been required yet at boot simply does not exist to be
    // found at that moment - a one-shot search permanently misses every copy registered later.
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
