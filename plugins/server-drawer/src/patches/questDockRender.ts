import { findByProps } from "@vendetta/metro";

export function patchQuestDockRender(cleanups: (() => void)[]): boolean {
    const mod = findByProps("useIsMobileQuestDockRendered");
    if (!mod?.useIsMobileQuestDockRendered) return false;

    const orig = mod.useIsMobileQuestDockRendered;
    mod.useIsMobileQuestDockRendered = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRendered = orig; });
    return true;
}
