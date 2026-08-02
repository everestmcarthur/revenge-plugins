import { rawFindByProps } from "../lib/rawFind";

// rawFindByProps, not findByProps - see questDockRender.ts for why (retried lookup, and
// Revenge's own findByProps permanently caches a "not found" result and never rescans).
export function patchQuestDockBase(cleanups: (() => void)[]): boolean {
    const mod = rawFindByProps("useIsMobileQuestDockRenderedBase");
    if (!mod?.useIsMobileQuestDockRenderedBase) return false;

    const orig = mod.useIsMobileQuestDockRenderedBase;
    mod.useIsMobileQuestDockRenderedBase = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRenderedBase = orig; });
    return true;
}
