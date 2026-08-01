import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { patchQuestDockRender } from "./patches/questDockRender";
import { patchQuestDockBase } from "./patches/questDockBase";
import { patchMobileQuestDock } from "./patches/mobileQuestDock";
import { patchGetQuestAsset } from "./patches/getQuestAsset";
import { patchExpanded, patchEmpty } from "./patches/contentPatch";
import { patchHideGuildsBar } from "./patches/hideGuildsBar";
import { patchCreateElement } from "./patches/createElementIntercept";
import { patchAutoCollapseFolders } from "./patches/autoCollapseFolders";
import Settings from "./ui/Settings";

let cleanups: (() => void)[] = [];

// Each of these functions already checks its own lookup and returns false instead of patching
// when it comes up empty - this wrapper adds one more layer so a lookup that throws outright
// (e.g. calling a property off an undefined module) can't take the rest of onLoad's patches
// down with it, same as every other plugin in this repo.
function tryPatch(name: string, fn: () => boolean): boolean {
    try {
        return fn();
    } catch (e) {
        logger.error(`[ServerDrawer] "${name}" patch threw, skipping: ${e}`);
        return false;
    }
}

function applyAll() {
    const applied: string[] = [];

    patchCreateElement(cleanups);

    if (tryPatch("questDockRender", () => patchQuestDockRender(cleanups))) applied.push("questDockRender");
    if (tryPatch("questDockBase", () => patchQuestDockBase(cleanups))) applied.push("questDockBase");
    if (tryPatch("mobileQuestDock", () => patchMobileQuestDock(cleanups))) applied.push("mobileQuestDock");
    if (tryPatch("getQuestAsset", () => patchGetQuestAsset(cleanups))) applied.push("getQuestAsset");
    if (tryPatch("expanded", () => patchExpanded(cleanups))) applied.push("expanded");
    if (tryPatch("collapsed", () => patchEmpty("QuestDockContentCollapsed", cleanups))) applied.push("collapsed");
    if (tryPatch("enrolledHeader", () => patchEmpty("QuestDockEnrolledHeader", cleanups))) applied.push("enrolledHeader");
    if (tryPatch("unenrolledHeader", () => patchEmpty("QuestDockUnenrolledHeader", cleanups))) applied.push("unenrolledHeader");
    if (tryPatch("enrolledBody", () => patchEmpty("QuestDockEnrolledBody", cleanups))) applied.push("enrolledBody");
    if (tryPatch("unenrolledBody", () => patchEmpty("QuestDockUnenrolledBody", cleanups))) applied.push("unenrolledBody");

    if (storage.hideGuildsBar) {
        if (tryPatch("hideGuildsBar", () => patchHideGuildsBar(cleanups))) applied.push("hideGuildsBar");
    }

    if (tryPatch("autoCollapseFolders", () => patchAutoCollapseFolders(cleanups))) applied.push("autoCollapseFolders");

    logger.log(`[ServerDrawer] onLoad done - ${applied.length}/12 patches applied (${applied.join(", ") || "none"})`);
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
        storage.showUnreadBadges ??= true;
        storage.autoCollapseFolders ??= false;
        storage.hideFolderIcons ??= false;

        applyAll();
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
