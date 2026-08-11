import { React } from "@vendetta/metro/common";
import { rawFind } from "../lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept, registerTypeDetector } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

// rawFind, not @vendetta/metro's find - the original plugin's one-shot find() calls are exactly
// why it needed a server tapped before the drawer would show: if the target module hadn't
// registered in Metro yet at the exact moment onLoad ran, find()'s result (undefined) is cached
// forever and never rescanned, so index.tsx's retry loop calling this again was pointless. rawFind
// walks window.modules directly on every call instead, so retrying actually has a chance to work.
let cachedGestureContext: any = null;
function getGestureContext(): any {
    if (!cachedGestureContext) {
        cachedGestureContext = rawFind((m) => m?.QuestDockGestureContext)?.QuestDockGestureContext ?? null;
    }
    return cachedGestureContext;
}

function isNamed(name: string) {
    return (type: any) => type?.name === name || type?.displayName === name ||
        type?.type?.name === name || type?.type?.displayName === name;
}

// Patches both QuestDockContentExpanded and QuestDockContentCollapsed to render the drawer, not
// just Expanded like the original. Confirmed live (Key Inspector) that restingQuestDockMode - the
// Reanimated value Discord uses to pick which of the two to render - starts as "collapsed" on a
// fresh load, not "expanded". Patching only Expanded left the drawer invisible behind whatever the
// collapsed variant showed (nothing, since that slot went through a separate null-patch) until
// something else happened to flip the mode. Swapping in the same drawer for both names sidesteps
// needing to fight that mode at all - whichever Discord picks, the drawer is what's there.
export function patchQuestDockSlot(name: string, cleanups: (() => void)[]): boolean {
    registerTypeDetector(`ServerDrawer.Slot.${name}`, isNamed(name), (real) => {
        registerIntercept(real, ServerDrawerSheet, { gestureContext: getGestureContext() });
        console.log(TAG, `PATCH: ${name} replaced (type detector)`);
    }, { persistent: true });

    const mod = rawFind((m) => isNamed(name)(m?.type));
    if (!mod?.type) {
        console.log(TAG, `WARN: ${name} not found yet (will retry)`);
        return false;
    }

    const orig = mod.type;
    registerIntercept(orig, ServerDrawerSheet, { gestureContext: getGestureContext() });
    mod.type = function ServerDrawerPatch() {
        return <ServerDrawerSheet gestureContext={getGestureContext()} />;
    };
    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, `PATCH: ${name} replaced (module mutation)`);
    return true;
}

// Sub-sections inside Discord's own dock content (header/body variants) - kept as null-patches
// like the original. Once patchQuestDockSlot above wins, Discord's real header/body components
// never get created in the first place, so this is mostly moot, but harmless to keep as a backup
// for whichever of the two patches loses its own boot race.
export function patchEmpty(name: string, cleanups: (() => void)[]): boolean {
    registerTypeDetector(`ServerDrawer.Empty.${name}`, isNamed(name), (real) => {
        registerIntercept(real, function EmptyPatch() { return null; });
        console.log(TAG, `PATCH: ${name} replaced (type detector)`);
    }, { persistent: true });

    const mod = rawFind((m) => isNamed(name)(m?.type));
    if (!mod?.type) {
        console.log(TAG, `WARN: ${name} not found yet (will retry)`);
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
        // Some property descriptors can't be copied onto another function - fine, this is a
        // best-effort compatibility shim, not something correctness depends on.
    }
    mod.type.displayName = name;

    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, `PATCH: ${name} replaced (module mutation)`);
    return true;
}
