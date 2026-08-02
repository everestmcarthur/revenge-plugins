import { rawFindByFunctionProps } from "../lib/rawFind";

// rawFindByFunctionProps, not findByProps or rawFindByProps - see questDockRender.ts for why
// (retried lookup that a caching findByProps would defeat, plus a confirmed-live decoy module
// with the same property names but non-function values that a plain rawFindByProps was matching).
export function patchQuestDockBase(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps("useIsMobileQuestDockRenderedBase");
    if (!mod?.useIsMobileQuestDockRenderedBase) return false;

    const orig = mod.useIsMobileQuestDockRenderedBase;
    mod.useIsMobileQuestDockRenderedBase = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRenderedBase = orig; });
    return true;
}
