export interface WaitForHandle {
    /** Stops polling. Safe to call even after `find` has already resolved. */
    cancel(): void;
}

/**
 * Polls `find` every `intervalMs` (default 100) until it returns a truthy value, then calls
 * `onFound` with it and stops polling.
 *
 * Needed because a plugin's onLoad can run before every Metro module/component it depends on has
 * actually been required - on a cold app start that's a real race, not an edge case. A one-shot
 * `findByX(...)` lookup at that exact moment can come back undefined and, without a retry, never
 * try again for the rest of the session. `waitFor` checks immediately (so there's no added delay
 * once the target is already registered) and keeps retrying otherwise.
 *
 * Returns a handle whose `cancel()` stops the poll - call it from a plugin's unpatch/onUnload so a
 * pending lookup doesn't keep firing (or apply a patch) after the plugin's been turned off.
 */
export function waitFor<T>(find: () => T | null | undefined, onFound: (value: T) => void, intervalMs = 100): WaitForHandle {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const immediate = find();
    if (immediate) {
        onFound(immediate);
        return { cancel() {} };
    }

    timer = setInterval(() => {
        if (cancelled) return;
        const value = find();
        if (value) {
            cancelled = true;
            clearInterval(timer);
            onFound(value);
        }
    }, intervalMs);

    return {
        cancel() {
            cancelled = true;
            if (timer) clearInterval(timer);
        }
    };
}
