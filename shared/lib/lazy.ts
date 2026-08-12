// Wraps a metro lookup so it isn't run until first used, retrying on every call until it succeeds
// once (then cached forever). Only for values used in event handlers or plain render logic -
// wrapping something used as a React hook can violate the Rules of Hooks, since resolved-or-not
// can change between renders.
export function lazy<T>(resolve: () => T | null | undefined): () => T | undefined {
    let cached: T | undefined;
    let resolved = false;

    return () => {
        if (resolved) return cached;
        const value = resolve();
        if (value != null) {
            cached = value;
            resolved = true;
        }
        return value ?? undefined;
    };
}
