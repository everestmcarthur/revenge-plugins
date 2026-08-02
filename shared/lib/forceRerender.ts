// The actual reason YouBar+'s buttons only ever showed up after a full reload: YouBar's own
// button is wrapped in React.memo with the default shallow-prop comparator, and it only ever
// receives one stable boolean prop. Once it mounts, React's own updateMemoComponent bailout means
// it will *never* run its render function again - regardless of how often anything around it
// re-renders - unless something upstream schedules real work that reaches this exact fiber. That
// makes patching `.type` alone invisible until pure luck (an unrelated future re-render) happens
// to touch it, which on a live device can be "eventually" or "never in this session" - matching
// exactly what looked like "needs 2 reloads."
//
// Two earlier versions of this file tried to actively force that render pass:
//  - Walking React's DevTools fiber-root registry (__REACT_DEVTOOLS_GLOBAL_HOOK__). Confirmed via
//    Key Inspector on a real device that hook doesn't exist on this Discord build at all - that
//    whole approach was silently doing nothing.
//  - Calling setParams() on the current route via getRootNavigationRef(), to force a genuine
//    react-navigation state update. This ran unconditionally, synchronously, the moment the button
//    module first initializes - which on a cold boot can be very early, before navigation has
//    fully settled. After shipping it, buttons stopped appearing even after a full restart - a
//    real regression, not just "still needs a reload." Poking live navigation state as an automatic
//    side effect of applying a UI patch is a meaningfully bigger risk than anything else in this
//    fix, and it's the prime suspect, so it's been pulled entirely rather than debugged further
//    blind. (It also used the cached findByProps instead of this repo's raw* variants, so on a
//    build where that lookup wasn't registered yet, it would have permanently poisoned
//    getRootNavigationRef for the rest of the session - a second, independent reason to drop it.)
//
// What's left is the one part that's unconditionally safe: if `target` is a memo wrapper,
// permanently override its `compare` so that whenever a future render pass *does* reach this fiber
// for any reason, it can never bail out again. This doesn't make buttons appear instantly on a hot
// toggle - that still needs a real trigger, which is worth another attempt, but only ever tested
// manually first via Key Inspector's Eval tool where its effect can actually be observed before
// it's wired back into anything that runs automatically.
export function forceRerender(target: any): void {
    try {
        if (target && typeof target === "object" && "compare" in target) {
            target.compare = () => false;
        }
    } catch {
        // Best effort - a shape mismatch here just means no permanent bailout override.
    }
}
