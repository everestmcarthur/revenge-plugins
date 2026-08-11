import { storage } from "@vendetta/plugin";
import { patchQuestDockRender, patchQuestDockBase, patchMobileQuestDock, patchGetQuestAsset } from "./patches/fakeQuestDock";
import { patchQuestDockSlot, patchEmpty } from "./patches/contentPatch";
import { patchHideGuildsBar } from "./patches/hideGuildsBar";
import { patchCreateElement } from "./lib/createElementIntercept";
import { patchAutoCollapseFolders } from "./patches/autoCollapseFolders";
import Settings from "./ui/Settings";

const TAG = "[ServerDrawer]";
let cleanups: (() => void)[] = [];

function applyAll() {
    console.log(TAG, "onLoad");

    let patched = 0;

    patchCreateElement(cleanups);
    patched++;

    if (storage.fakeQuestDock !== false) {
        if (patchQuestDockRender(cleanups)) patched++;
        if (patchQuestDockBase(cleanups)) patched++;
        if (patchMobileQuestDock(cleanups)) patched++;
        if (patchGetQuestAsset(cleanups)) patched++;
    }
    if (patchQuestDockSlot("QuestDockContentExpanded", cleanups)) patched++;
    if (patchQuestDockSlot("QuestDockContentCollapsed", cleanups)) patched++;
    if (patchEmpty("QuestDockEnrolledHeader", cleanups)) patched++;
    if (patchEmpty("QuestDockUnenrolledHeader", cleanups)) patched++;
    if (patchEmpty("QuestDockEnrolledBody", cleanups)) patched++;
    if (patchEmpty("QuestDockUnenrolledBody", cleanups)) patched++;
    if (patchAutoCollapseFolders(cleanups)) patched++;
    if (storage.hideGuildsBar !== false && patchHideGuildsBar(cleanups)) patched++;

    console.log(TAG, `onLoad done - ${patched} patches applied, ${cleanups.length} cleanups`);
}

function unpatchAll() {
    for (const fn of cleanups) {
        try {
            fn();
        } catch {
            // A patch failing to undo shouldn't block the others from unwinding.
        }
    }
    cleanups = [];
}

export function restart() {
    unpatchAll();
    applyAll();
}

export default {
    onLoad: () => {
        storage.hideGuildsBar ??= true;
        storage.showGuildNames ??= true;
        storage.autoCollapseFolders ??= false;
        storage.hideFolderIcons ??= false;
        storage.fakeQuestDock ??= true;

        applyAll();
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
