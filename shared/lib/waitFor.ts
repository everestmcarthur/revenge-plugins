export interface WaitForHandle {
    /** Stops polling. Safe to call even after `find` has already resolved. */
    cancel(): void;
}

// Polls `find` every `intervalMs` until it returns a truthy value, then calls `onFound` and stops.
// Checks immediately first, so there's no added delay if the target is already registered. Call
// the returned handle's cancel() from onUnload so a pending lookup can't fire after the plugin's
// turned off.
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
