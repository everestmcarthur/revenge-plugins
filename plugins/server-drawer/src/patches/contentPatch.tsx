import { React } from "@vendetta/metro/common";
import { rawFind } from "../lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept, registerPropsTransform, registerTypeDetector } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

// rawFind, not @vendetta/metro's find - both patchExpanded and patchEmpty are retried by index.ts's
// fast-retry loop, and Revenge's own find() permanently caches a "not found" result per call site
// and never rescans (see rawFind.ts), which would make the retry pointless after the first
// failed attempt.
let cachedGestureContext: any = null;
function getGestureContext(): any {
    if (!cachedGestureContext) {
        cachedGestureContext = rawFind((m) => m?.QuestDockGestureContext)?.QuestDockGestureContext ?? null;
    }
    return cachedGestureContext;
}

// Memo-wrapped components have no own .name/.displayName - only their nested .type does (confirmed
// live for GuildsBar). Checked in addition to the direct check, not instead of it.
function isNamed(name: string) {
    return (type: any) => type?.name === name || type?.displayName === name ||
        type?.type?.name === name || type?.type?.displayName === name;
}

const QUEST_DOCK_NAMES = [
    "QuestDock",
    "QuestDockBase",
    "QuestDockWithQuestContext",
    "QuestDockMain",
    "QuestDockContent",
    "QuestDockExpanded",
];

function isQuestDock(type: any): boolean {
    return QUEST_DOCK_NAMES.some((name) => isNamed(name)(type));
}

function ServerDrawerSheetWrapper() {
    return <ServerDrawerSheet gestureContext={getGestureContext()} />;
}

/**
 * Two independent mechanisms, both active. Mutating the found module's own `.type` property
 * (matched here by isNamed, same nested-memo-aware check GuildsBar's patch uses) makes the drawer
 * render immediately if the target module happens to already be registered in Metro by the time
 * this runs. But that registration only happens once Discord's own code actually renders Quest
 * Dock's expanded content at least once - which itself depends on questDockContext.ts's Context
 * value force having already taken effect, and on Discord's own render pass actually happening
 * within this plugin's ~10s retry window. That's a real boot-time race, confirmed live: identical
 * code gave different results (drawer showing vs not) across genuinely clean reinstalls, pointing
 * at timing rather than a deterministic bug.
 *
 * registerTypeDetector has no such timing dependency - it inspects the `type` argument passed
 * directly to createElement/jsx at the moment something actually creates an element with it,
 * whenever that happens, early or late. Combining both means the drawer shows as fast as possible
 * when the race is won, and still shows correctly even when it's lost.
 */
export function patchExpanded(cleanups: (() => void)[]): boolean {
    const questDockTypes = new Set<any>();

    // Make the quest dock's wrapper(s) transparent - the ServerDrawerSheet content still renders on
    // top, but the panel/drawer background that used to be behind the quest menu is removed.
    registerPropsTransform(
        (_props: any, type: any) => questDockTypes.has(type),
        (props: any) => ({ ...props, style: [props?.style, { backgroundColor: "transparent" }] }),
    );

    registerTypeDetector("ServerDrawer.QuestDockBg", isQuestDock, (real) => {
        questDockTypes.add(real);
        console.log(TAG, "PATCH: QuestDock wrapper set transparent", real?.name ?? real?.displayName);
    }, { persistent: true });

    registerTypeDetector("ServerDrawer.Expanded", isNamed("QuestDockContentExpanded"), (real) => {
        registerIntercept(real, ServerDrawerSheetWrapper);
        console.log(TAG, "PATCH: QuestDockContentExpanded replaced (type detector)");
    });

    const mod = rawFind((m) => isNamed("QuestDockContentExpanded")(m?.type));
    if (!mod?.type) {
        console.log(TAG, "WARN: QuestDockContentExpanded module not found yet (will retry)");
        return false;
    }

    const orig = mod.type;
    registerIntercept(orig, ServerDrawerSheetWrapper);
    mod.type = ServerDrawerSheetWrapper;
    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, "PATCH: QuestDockContentExpanded replaced (module mutation)");
    return true;
}

export function patchEmpty(name: string, cleanups: (() => void)[]): boolean {
    registerTypeDetector(`ServerDrawer.Empty.${name}`, isNamed(name), (real) => {
        registerIntercept(real, function EmptyPatch() { return null; });
        console.log(TAG, `PATCH: ${name} replaced (type detector)`);
    });

    const mod = rawFind((m) => isNamed(name)(m?.type));
    if (!mod?.type) {
        console.log(TAG, `WARN: ${name} module not found yet (will retry)`);
        return false;
    }

    const orig = mod.type;
    function EmptyPatch() {
        return null;
    }
    mod.type = EmptyPatch;

    try {
        Object.defineProperties(mod.type, Object.getOwnPropertyDescriptors(orig));
    } catch {
        // Some property descriptors can't be copied onto another function (e.g. non-configurable
        // ones on certain memo/forwardRef wrappers) - fine, this is a best-effort compatibility
        // shim, not something correctness depends on.
    }
    mod.type.displayName = name;

    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, `PATCH: ${name} replaced (module mutation)`);
    return true;
}
