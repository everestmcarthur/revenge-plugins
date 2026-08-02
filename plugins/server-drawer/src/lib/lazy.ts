/**
 * Wraps a metro lookup so it isn't run until first actually used, and retries on every call until
 * it succeeds once (after which the result is cached forever). A plugin's top-level module code
 * runs as soon as its bundle is required, which can be before Discord's own code has required an
 * internal module it depends on - a one-shot findByX() at module scope can permanently cache
 * undefined even though the real module becomes available moments later. Only meant for values
 * used inside event handlers or plain (non-hook) render logic - wrapping something used as a
 * React hook (e.g. passed to useContext) in this can violate the Rules of Hooks, since the
 * resolved-or-not status is now allowed to change between renders of the same component instance.
 */
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
