import { findByProps } from "@vendetta/metro";

declare const window: any;

// The actual reason YouBar+'s buttons only ever showed up after a full reload: YouBar's own
// button is wrapped in React.memo with the default shallow-prop comparator, and it only ever
// receives one stable boolean prop. Once it mounts, React's own updateMemoComponent bailout means
// it will *never* run its render function again - regardless of how often anything around it
// re-renders - unless something upstream schedules real work that reaches this exact fiber. That
// makes patching `.type` alone invisible until pure luck (an unrelated future re-render) happens
// to touch it, which on a live device can be "eventually" or "never in this session" - matching
// exactly what looked like "needs 2 reloads."
//
// The first version of this file tried to force that update by walking React's DevTools fiber-root
// registry (__REACT_DEVTOOLS_GLOBAL_HOOK__). Confirmed via Key Inspector on a real device that
// hook simply doesn't exist on this Discord build at all - React never gets a chance to register
// with it, so that whole approach was silently doing nothing. This version instead uses a real,
// public react-navigation API that Key Inspector also confirmed works: getRootNavigationRef().
//
// This does two things, both best-effort and safe to call redundantly:
//  1. If `target` is a memo wrapper, permanently override its `compare` so any future
//     reconciliation pass that reaches it never bails out again.
//  2. Force a pass to reach it *right now* by calling setParams() on the currently-focused route
//     with its own unchanged params. That's a genuine react-navigation state update (a new state
//     object, not a no-op) - and unlike a plain prop diff, navigation state is read through
//     context, which React always propagates through memoized descendants that consume it, instead
//     of letting them silently bail like a prop-only update would.
// If either step's assumptions don't hold on a given build, it just silently no-ops - the existing
// patch and poll are still in place, so the worst case is unchanged from before (shows up on the
// next natural re-render or reload), never a crash.
export function forceRerender(target: any): void {
    try {
        if (target && typeof target === "object" && "compare" in target) {
            target.compare = () => false;
        }
    } catch {
        // Best effort - a shape mismatch here just means no permanent bailout override.
    }

    try {
        const navRef = findByProps("getRootNavigationRef")?.getRootNavigationRef?.();
        if (!navRef?.isReady?.()) return;

        const route = navRef.getCurrentRoute?.();
        if (route && typeof navRef.setParams === "function") {
            navRef.setParams(route.params ?? {});
        }
    } catch {
        // Best effort - no navigation ref yet, or an internal shape change.
    }
}
