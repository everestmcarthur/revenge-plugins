import { patchQuestDockRender } from "./patches/questDockRender";
import { patchQuestDockBase } from "./patches/questDockBase";
import { patchMobileQuestDock } from "./patches/mobileQuestDock";
import { patchGetQuestAsset } from "./patches/getQuestAsset";
import { patchExpanded, patchEmpty } from "./patches/contentPatch";
import { patchHideGuildsBar } from "./patches/hideGuildsBar";
import { patchTransparentBackground } from "./patches/transparentBackground";
import { patchCreateElement } from "./patches/createElementIntercept";
import { id, storage } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import Settings from "./ui/Settings";

const TAG = "[ServerDrawer]";
let unpatchAll: () => void = () => {};

export default {
    onLoad() {
        storage.hideDmTile ??= false;
        storage.showGuildNames ??= false;

        console.log(TAG, "onLoad");

        unpatchAll = guardPlugin(id, () => {
            const cleanups: (() => void)[] = [];
            let patched = 0;

            patchCreateElement(cleanups);
            patched++;

            if (patchQuestDockRender(cleanups)) patched++;
            if (patchQuestDockBase(cleanups)) patched++;
            if (patchMobileQuestDock(cleanups)) patched++;
            if (patchGetQuestAsset(cleanups)) patched++;
            if (patchExpanded(cleanups)) patched++;
            if (patchEmpty("QuestDockContentCollapsed", cleanups)) patched++;
            if (patchEmpty("QuestDockEnrolledHeader", cleanups)) patched++;
            if (patchEmpty("QuestDockUnenrolledHeader", cleanups)) patched++;
            if (patchEmpty("QuestDockEnrolledBody", cleanups)) patched++;
            if (patchEmpty("QuestDockUnenrolledBody", cleanups)) patched++;
            if (patchHideGuildsBar(cleanups)) patched++;
            if (patchTransparentBackground(cleanups)) patched++;

            console.log(TAG, `onLoad done — ${patched} patches applied, ${cleanups.length} cleanups`);
            return () => {
                for (const fn of cleanups) fn();
                cleanups.length = 0;
            };
        });
    },
    onUnload() {
        console.log(TAG, "onUnload");
        unpatchAll();
    },
    settings: Settings,
};
