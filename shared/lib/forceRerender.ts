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
// This does two things, both best-effort and safe to call redundantly:
//  1. If `target` is a memo wrapper, permanently override its `compare` to always report "props
//     changed" - so from this point on, any future reconciliation pass that *does* reach this
//     fiber for any reason will never bail out again.
//  2. Force one reconciliation pass to reach it *right now* instead of waiting on (1) alone, via
//     React's own DevTools fiber-root registry - which every RN app populates purely because React
//     itself reports its roots there, with no real inspector needing to be attached (confirmed
//     present in Discord's own bundle via `__REACT_DEVTOOLS_GLOBAL_HOOK__`). Once the live fiber
//     for `target` is found, this walks up to the nearest real class-component ancestor and calls
//     its public, ordinary `forceUpdate()` - a genuinely scheduled update, so React correctly
//     descends all the way down through every bailout on the way to us, instead of skipping this
//     part of the tree entirely as "nothing pending here."
// If either step's assumptions don't hold on a given build, it just silently no-ops - the existing
// patch and poll are still in place, so the worst case is unchanged from today (shows up on the
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
        const hook = window?.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const renderers = hook?.renderers;
        if (!hook?.getFiberRoots || !renderers?.keys) return;

        for (const rendererID of renderers.keys()) {
            const roots: Set<any> | undefined = hook.getFiberRoots(rendererID);
            if (!roots) continue;

            for (const root of roots) {
                const fiber = findFiberByType(root.current, target);
                if (fiber && bump(fiber)) return;
            }
        }
    } catch {
        // Best effort - no devtools hook, no fiber roots, or an internal shape change.
    }
}

/** Iterative (not recursive) so an unusually deep RN fiber tree can't blow the JS call stack. */
function findFiberByType(root: any, target: any): any {
    const stack = root ? [root] : [];
    let guard = 0;

    while (stack.length) {
        if (++guard > 200_000) return null; // Pathological tree - bail rather than hang.

        const fiber = stack.pop();
        if (!fiber) continue;
        if (fiber.type === target || fiber.elementType === target) return fiber;

        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
    }

    return null;
}

/** Walks up from `fiber` to the nearest class component and calls its real forceUpdate(). */
function bump(fiber: any): boolean {
    let node = fiber;
    while (node) {
        if (typeof node.stateNode?.forceUpdate === "function") {
            node.stateNode.forceUpdate();
            return true;
        }
        node = node.return;
    }
    return false;
}
