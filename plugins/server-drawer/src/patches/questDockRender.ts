import { rawFindByFunctionProps } from "../lib/rawFind";

// rawFindByFunctionProps, not rawFindByProps or findByProps. Two separate reasons:
// 1. This gets retried by index.ts's fast-retry loop, and Revenge's own findByProps permanently
//    caches a "not found" result and never rescans (see rawFind.ts), which would make the retry
//    pointless after the first failed attempt.
// 2. Confirmed live (Key Inspector's Eval console) that plain rawFindByProps was matching a
//    completely unrelated, lower-module-id module whose properties happen to share these exact
//    names but hold non-function (type-shape-looking object) values - window.modules iterates in
//    ascending id order, so that decoy always won over the real, higher-id hook implementation.
//    rawFindByFunctionProps additionally requires the matched property to actually be a function,
//    which the decoy isn't. See rawFind.ts for the full writeup.
export function patchQuestDockRender(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps("useIsMobileQuestDockRendered");
    if (!mod?.useIsMobileQuestDockRendered) return false;

    const orig = mod.useIsMobileQuestDockRendered;
    mod.useIsMobileQuestDockRendered = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRendered = orig; });
    return true;
}
