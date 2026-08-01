import { rawFindByProps } from "@shared/lib/rawFind";

const TAG = "[ServerDrawer]";

// rawFindByProps, not findByProps - see questDockRender.ts for why (retried lookup, and
// Revenge's own findByProps permanently caches a "not found" result and never rescans).
export function patchGetQuestAsset(cleanups: (() => void)[]): boolean {
    const mod = rawFindByProps("getQuestAsset");
    if (!mod?.getQuestAsset) {
        console.log(TAG, "WARN: getQuestAsset not found");
        return false;
    }
    const orig = mod.getQuestAsset;
    mod.getQuestAsset = function (...args: any[]) {
        try {
            return orig.apply(this, args);
        } catch {
            return { url: null, isAnimated: false };
        }
    };
    cleanups.push(() => { mod.getQuestAsset = orig; });
    return true;
}
