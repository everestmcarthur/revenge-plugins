import { React } from "@vendetta/metro/common";

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
let origCreateElement: typeof React.createElement | null = null;
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

export function patchCreateElement(cleanups: (() => void)[]) {
    if (isPatched) return;

    // Guard against React.createElement being null in some environments
    origCreateElement = React.createElement;
    if (!origCreateElement) {
        console.warn("[ServerDrawer] React.createElement is null, skipping patch");
        return;
    }

    const patched = function (type: any, props: any, ...rest: any[]) {
        if (!origCreateElement) {
            // Fallback to original createElement if somehow null (should not happen)
            return React.createElement(type, props, ...rest);
        }
        if (props) {
            for (const { predicate, replacement } of propsIntercepts) {
                try {
                    if (predicate(props)) {
                        return replacement ? origCreateElement.call(React, replacement, props, ...rest) : null;
                    }
                } catch {
                    // A bad predicate shouldn't block every other element from rendering.
                }
            }
        }

        const entry = intercepts.get(type);
        if (entry) {
            const newProps = entry.extraProps
                ? { ...props, ...entry.extraProps }
                : props;
            return origCreateElement.call(React, entry.replacement, newProps, ...rest);
        }
        return origCreateElement.call(React, type, props, ...rest);
    };

    Object.assign(patched, origCreateElement);
    React.createElement = patched as typeof React.createElement;
    isPatched = true;

    cleanups.push(() => {
        if (isPatched && origCreateElement) {
            React.createElement = origCreateElement;
            isPatched = false;
        }
        intercepts.clear();
        propsIntercepts.length = 0;
    });
}
