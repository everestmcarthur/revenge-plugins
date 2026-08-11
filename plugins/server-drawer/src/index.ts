import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { patchQuestDockRender, patchQuestDockBase, patchMobileQuestDock, patchGetQuestAsset } from "./patches/fakeQuestDock";
import { patchExpanded, patchEmpty } from "./patches/contentPatch";
import { patchHideGuildsBar } from "./patches/hideGuildsBar";
import { patchCreateElement } from "./lib/createElementIntercept";
import { patchAutoCollapseFolders } from "./patches/autoCollapseFolders";
import Settings from "./ui/Settings";

let cleanups: (() => void)[] = [];
let retryHandle: ReturnType<typeof setInterval> | undefined;

// Each of these functions already checks its own lookup and returns false instead of patching
// when it comes up empty - this wrapper adds one more layer so a lookup that throws outright
// can't take the rest of onLoad's patches down with it.
function tryPatch(name: string, fn: () => boolean): boolean {
    try {
        return fn();
    } catch (e) {
        logger.error(`[ServerDrawer] "${name}" patch threw, skipping: ${e}`);
        return false;
    }
}

// The Quest Dock (and the internals it depends on) isn't guaranteed to be registered in Metro yet
// at the exact moment onLoad runs. Confirmed live across many reload cycles tonight: without a
// retry loop, each of this plugin's independent module lookups is effectively an independent
// coin-flip on any given boot - not tied to any one account or feature, just whichever modules
// happened to already be registered when onLoad ran. Retrying whatever hasn't landed yet on a fast
// interval until everything's applied (or it gives up after ~10s) is what makes this reliable
// instead of "sometimes works."
function applyAll() {
    const patchers: Record<string, () => boolean> = {
        ...(storage.fakeQuestDock !== false ? {
            questDockRender: () => patchQuestDockRender(cleanups),
            questDockBase: () => patchQuestDockBase(cleanups),
            mobileQuestDock: () => patchMobileQuestDock(cleanups),
            getQuestAsset: () => patchGetQuestAsset(cleanups),
        } : {}),
        expanded: () => patchExpanded(cleanups),
        collapsed: () => patchEmpty("QuestDockContentCollapsed", cleanups),
        enrolledHeader: () => patchEmpty("QuestDockEnrolledHeader", cleanups),
        unenrolledHeader: () => patchEmpty("QuestDockUnenrolledHeader", cleanups),
        enrolledBody: () => patchEmpty("QuestDockEnrolledBody", cleanups),
        unenrolledBody: () => patchEmpty("QuestDockUnenrolledBody", cleanups),
        autoCollapseFolders: () => patchAutoCollapseFolders(cleanups),
        ...(storage.hideGuildsBar !== false ? { hideGuildsBar: () => patchHideGuildsBar(cleanups) } : {}),
    };

    patchCreateElement(cleanups);

    const pending = new Set(Object.keys(patchers));
    const applied = new Set<string>();

    const attempt = () => {
        for (const name of pending) {
            if (tryPatch(name, patchers[name])) {
                applied.add(name);
                pending.delete(name);
            }
        }

        if (pending.size === 0 && retryHandle) {
            clearInterval(retryHandle);
            retryHandle = undefined;
        }
    };

    attempt();

    if (pending.size > 0) {
        let ticks = 0;
        retryHandle = setInterval(() => {
            attempt();
            if (++ticks >= 50 && retryHandle) { // ~10s at 200ms
                clearInterval(retryHandle);
                retryHandle = undefined;
                if (pending.size > 0) {
                    logger.error(`[ServerDrawer] Gave up waiting on: ${[...pending].join(", ")}`);
                }
            }
        }, 200);
    }

    logger.log(`[ServerDrawer] onLoad: applied immediately - ${[...applied].join(", ") || "none"}${pending.size ? `, still waiting on ${[...pending].join(", ")}` : ""}`);
}

function unpatchAll() {
    if (retryHandle) {
        clearInterval(retryHandle);
        retryHandle = undefined;
    }
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
