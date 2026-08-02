import { rawFindByFunctionProps } from "../lib/rawFind";

const TAG = "[ServerDrawer]";

// rawFindByFunctionProps, not findByProps or rawFindByProps - see questDockRender.ts for why
// (retried lookup that a caching findByProps would defeat, plus a confirmed-live decoy module
// with the same property names but non-function values that a plain rawFindByProps was matching).
export function patchGetQuestAsset(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps("getQuestAsset");
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
