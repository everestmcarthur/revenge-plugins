import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { patchFakeQuestDock } from "./patches/fakeQuestDock";
import { patchExpanded, patchEmpty } from "./patches/contentPatch";
import { patchHideGuildsBar } from "./patches/hideGuildsBar";
import { patchCreateElement } from "./lib/createElementIntercept";
import { patchAutoCollapseFolders } from "./patches/autoCollapseFolders";
import Settings from "./ui/Settings";

let cleanups: (() => void)[] = [];
let retryHandle: ReturnType<typeof setInterval> | undefined;

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

// The Quest Dock (and the internals it depends on) isn't guaranteed to be registered in Metro yet
// at the exact moment onLoad runs - same class of startup race fixed elsewhere in this repo
// (YouBar+'s button patch, ServerDrawer's own navigation lookups). A single onLoad attempt could
// permanently miss one or more of these, which is what "the drawer sometimes just doesn't show up"
// looked like. Instead of one shot, this retries whatever hasn't landed yet on a fast interval
// until everything's applied (or it gives up after ~10s, which would mean something's genuinely
// missing rather than just not loaded yet).
function applyAll() {
    const patchers: Record<string, () => boolean> = {
        ...(storage.fakeQuestDock ? { fakeQuestDock: () => patchFakeQuestDock(cleanups) } : {}),
        expanded: () => patchExpanded(cleanups),
        collapsed: () => patchEmpty("QuestDockContentCollapsed", cleanups),
        enrolledHeader: () => patchEmpty("QuestDockEnrolledHeader", cleanups),
        unenrolledHeader: () => patchEmpty("QuestDockUnenrolledHeader", cleanups),
        enrolledBody: () => patchEmpty("QuestDockEnrolledBody", cleanups),
        unenrolledBody: () => patchEmpty("QuestDockUnenrolledBody", cleanups),
        autoCollapseFolders: () => patchAutoCollapseFolders(cleanups),
        ...(storage.hideGuildsBar ? { hideGuildsBar: () => patchHideGuildsBar(cleanups) } : {}),
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
        storage.showUnreadBadges ??= true;
        storage.autoCollapseFolders ??= false;
        storage.hideFolderIcons ??= false;
        storage.fakeQuestDock ??= true;

        applyAll();
    },
    onUnload: () => unpatchAll(),
    settings: Settings,
};
