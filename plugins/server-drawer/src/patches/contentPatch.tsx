import { React } from "@vendetta/metro/common";
import { rawFind } from "../lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

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

export function patchQuestDockSlot(name: string, cleanups: (() => void)[]): boolean {
    const mod = rawFind((m) => isNamed(name)(m?.type));
    if (!mod?.type) {
        console.log(TAG, `WARN: ${name} not found (will retry)`);
        return false;
    }
    const orig = mod.type;

    registerIntercept(orig, ServerDrawerSheet, { gestureContext: getGestureContext() });

    mod.type = function ServerDrawerPatch() {
        return <ServerDrawerSheet gestureContext={getGestureContext()} />;
    };
    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, `PATCH: ${name} replaced`);
    return true;
}

export function patchEmpty(name: string, cleanups: (() => void)[]): boolean {
    const mod = rawFind((m) => isNamed(name)(m?.type));
    if (!mod?.type) {
        console.log(TAG, `WARN: ${name} not found`);
        return false;
    }
    const orig = mod.type;
    const originalComponent = orig;

    mod.type = function EmptyPatch() {
        return null;
    };

    if (originalComponent) {
        try {
            Object.defineProperties(mod.type, Object.getOwnPropertyDescriptors(originalComponent));
        } catch {
            // Best-effort - not every descriptor can be copied onto another function.
        }
        mod.type.displayName = name;
    }

    cleanups.push(() => { mod.type = orig; });
    return true;
}
