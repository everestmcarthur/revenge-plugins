import { rawFindByProps } from "../lib/rawFind";

// rawFindByProps, not findByProps - this gets retried by index.ts's fast-retry loop, and
// Revenge's own findByProps permanently caches a "not found" result and never rescans (see
// rawFind.ts), which would make the retry pointless after the first failed attempt.
export function patchQuestDockRender(cleanups: (() => void)[]): boolean {
    const mod = rawFindByProps("useIsMobileQuestDockRendered");
    if (!mod?.useIsMobileQuestDockRendered) return false;

    const orig = mod.useIsMobileQuestDockRendered;
    mod.useIsMobileQuestDockRendered = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRendered = orig; });
    return true;
}
