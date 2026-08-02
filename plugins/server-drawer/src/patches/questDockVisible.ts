import { rawFindByProps } from "../lib/rawFind";

// A third gate alongside useIsMobileQuestDockRendered/useIsMobileQuestDockRenderedBase, found by
// reading the component that actually consumes all three together
// (QuestDockWithQuestContext, confirmed against decompiled current-build Discord source): even
// with the quest data faked and the "rendered" hooks forced true, this one still decides whether
// the dock is visible right now based on navigation route and channel-focus state - so without
// forcing it too, the drawer could still never show up depending on what screen you're on.
export function patchQuestDockVisible(cleanups: (() => void)[]): boolean {
    const mod = rawFindByProps("useIsMobileQuestDockVisibleToUser");
    if (!mod?.useIsMobileQuestDockVisibleToUser) return false;

    const orig = mod.useIsMobileQuestDockVisibleToUser;
    mod.useIsMobileQuestDockVisibleToUser = function (...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockVisibleToUser = orig; });
    return true;
}
