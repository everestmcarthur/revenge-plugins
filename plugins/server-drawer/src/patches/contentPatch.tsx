import { React } from "@vendetta/metro/common";
import { rawFind } from "../lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept, registerPropsTransform, registerTypeDetector } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

// rawFind, not @vendetta/metro's find - Revenge's own find() permanently caches a "not found"
// result per search and never rescans, which makes retrying pointless after the first failed
// attempt. Confirmed live tonight across many reload cycles: without retry, roughly a third of the
// independent lookups this plugin needs fail on any given boot, at random - not specific to any
// one account or feature.
let cachedGestureContext: any = null;
function getGestureContext(): any {
    if (!cachedGestureContext) {
        cachedGestureContext = rawFind((m) => m?.QuestDockGestureContext)?.QuestDockGestureContext ?? null;
    }
    return cachedGestureContext;
}

// Memo-wrapped components have no own .name/.displayName - only their nested .type does.
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

const SD_DRAWER_TEST_ID = "ServerDrawer";

function hasChildWithTestID(children: any, rest: any[], testID: string): boolean {
    const inspect = (child: any) => child != null && typeof child === "object" && child.props?.testID === testID;
    if (children != null) {
        if (Array.isArray(children)) { if (children.some(inspect)) return true; }
        else if (inspect(children)) return true;
    }
    for (const child of rest) if (inspect(child)) return true;
    return false;
}

function ServerDrawerSheetWrapper() {
    return <ServerDrawerSheet gestureContext={getGestureContext()} />;
}

/**
 * Two independent mechanisms, both active. Mutating the found module's own `.type` property makes
 * the drawer render immediately if the target module happens to already be registered in Metro by
 * the time this runs, but that's a real boot-time race.
 *
 * registerTypeDetector has no such timing dependency - it inspects the `type` argument passed
 * directly to createElement/jsx at the moment something actually creates an element with it,
 * whenever that happens, early or late. Combining both means the drawer shows as fast as possible
 * when the race is won, and still shows correctly even when it's lost.
 *
 * Only QuestDockContentExpanded is swapped for the drawer - QuestDockContentCollapsed is patched to
 * render nothing (see patchEmpty below), same as every other sub-section. Confirmed live that
 * patching both to show the full drawer causes it to render twice: Discord creates both elements
 * simultaneously in some cases (very likely a collapse/expand transition state), not just
 * whichever one restingQuestDockMode currently selects.
 */
export function patchExpanded(cleanups: (() => void)[]): boolean {
    const questDockTypes = new Set<any>();

    // Make the quest dock's wrapper(s) transparent - the ServerDrawerSheet content still renders on
    // top, but the panel/drawer background that used to be behind the quest menu is removed.
    registerPropsTransform(
        (props: any, type: any, rest: any[]) =>
            questDockTypes.has(type) ||
            hasChildWithTestID(props?.children, rest, SD_DRAWER_TEST_ID),
        (props: any) => ({ ...props, style: [props?.style, { backgroundColor: "transparent" }] }),
    );

    registerTypeDetector("ServerDrawer.QuestDockBg", isQuestDock, (real) => {
        questDockTypes.add(real);
        console.log(TAG, "PATCH: QuestDock wrapper set transparent", real?.name ?? real?.displayName);
    }, { persistent: true });

    registerTypeDetector("ServerDrawer.Expanded", isNamed("QuestDockContentExpanded"), (real) => {
        registerIntercept(real, ServerDrawerSheetWrapper, { testID: SD_DRAWER_TEST_ID });
        console.log(TAG, "PATCH: QuestDockContentExpanded replaced (type detector)");
    }, { persistent: true });

    const mod = rawFind((m) => isNamed("QuestDockContentExpanded")(m?.type));
    if (!mod?.type) {
        console.log(TAG, "WARN: QuestDockContentExpanded module not found yet (will retry)");
        return false;
    }

    const orig = mod.type;
    registerIntercept(orig, ServerDrawerSheetWrapper, { testID: SD_DRAWER_TEST_ID });
    mod.type = ServerDrawerSheetWrapper;
    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, "PATCH: QuestDockContentExpanded replaced (module mutation)");
    return true;
}

export function patchEmpty(name: string, cleanups: (() => void)[]): boolean {
    registerTypeDetector(`ServerDrawer.Empty.${name}`, isNamed(name), (real) => {
        registerIntercept(real, function EmptyPatch() { return null; });
        console.log(TAG, `PATCH: ${name} replaced (type detector)`);
    }, { persistent: true });

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
        // Best-effort compatibility shim, not something correctness depends on.
    }
    mod.type.displayName = name;

    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, `PATCH: ${name} replaced (module mutation)`);
    return true;
}
