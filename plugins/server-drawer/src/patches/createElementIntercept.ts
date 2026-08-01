import { React } from "@vendetta/metro/common";
import { find } from "@vendetta/metro";

interface Intercept {
    replacement: React.ComponentType<any>;
    extraProps?: Record<string, any>;
}

interface PropsIntercept {
    predicate: (props: any) => boolean;
    replacement: React.ComponentType<any> | null;
}

const intercepts = new Map<React.ComponentType<any>, Intercept>();
const propsIntercepts: PropsIntercept[] = [];
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

/** Returns a replacement type if this element should be intercepted, `null` to render nothing, or `undefined` to pass through unchanged. */
function resolveReplacement(type: any, props: any): { type: any; props: any } | null | undefined {
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
    // createElement misses every one of Discord's own render calls entirely, which is why
    // hideGuildsBar's intercept never actually did anything even though it registered correctly.
    // Found by shape (jsx/jsxs/Fragment together), not by name, for the same reason everything
    // else in this file avoids name-based lookups.
    const jsxRuntime = find((m: any) => typeof m?.jsx === "function" && typeof m?.jsxs === "function" && "Fragment" in m);
    const restoreJsx: (() => void)[] = [];

    if (jsxRuntime) {
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
    } else {
        console.warn("[ServerDrawer] jsx-runtime module not found, only classic createElement calls will be intercepted");
    }

    cleanups.push(() => {
        if (isPatched) {
            React.createElement = origCreateElement;
            isPatched = false;
        }
        restoreJsx.forEach((fn) => fn());
        intercepts.clear();
        propsIntercepts.length = 0;
    });
}
