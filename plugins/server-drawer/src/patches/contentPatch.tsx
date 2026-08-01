import { React } from "@vendetta/metro/common";
import { rawFind } from "@shared/lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept } from "./createElementIntercept";

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

export function patchExpanded(
    cleanups: (() => void)[]
): boolean {
    const mod = rawFind((m) => m?.type?.displayName === "QuestDockContentExpanded" || m?.type?.name === "QuestDockContentExpanded");
    if (!mod?.type) {
        console.log(TAG, "WARN: QuestDockContentExpanded not found (will retry)");
        return false;
    }
    const orig = mod.type;

    registerIntercept(orig, ServerDrawerSheet, { gestureContext: getGestureContext() });

    mod.type = function ServerDrawerPatch() {
        return <ServerDrawerSheet gestureContext={getGestureContext()} />;
    };
    cleanups.push(() => { mod.type = orig; });
    console.log(TAG, "PATCH: QuestDockContentExpanded replaced");
    return true;
}

export function patchEmpty(
    name: string,
    cleanups: (() => void)[]
): boolean {
    const mod = rawFind((m) => m?.type?.displayName === name || m?.type?.name === name);
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
        Object.defineProperties(mod.type, Object.getOwnPropertyDescriptors(originalComponent));
        mod.type.displayName = name;
    }

    cleanups.push(() => { mod.type = orig; });
    return true;
}
