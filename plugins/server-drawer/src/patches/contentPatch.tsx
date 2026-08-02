import { React } from "@vendetta/metro/common";
import { rawFind } from "../lib/rawFind";
import ServerDrawerSheet from "../components/ServerDrawerSheet";
import { registerIntercept, registerTypeDetector } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

let cachedGestureContext: any = null;
function getGestureContext(): any {
    if (!cachedGestureContext) {
        cachedGestureContext = rawFind((m) => m?.QuestDockGestureContext)?.QuestDockGestureContext ?? null;
    }
    return cachedGestureContext;
}

// Same fix as hideGuildsBar.tsx: memo-wrapped components are passed to createElement/jsx as the
// outer wrapper object, which has no own .name/.displayName - only its nested .type does. Missing
// that nested check meant this never matched anything, which is why Discord's real
// QuestDockEnrolledHeader (and friends) kept running unpatched against the fake quest data.
function isNamed(name: string) {
    return (type: any) => type?.name === name || type?.displayName === name ||
        type?.type?.name === name || type?.type?.displayName === name;
}

function Nothing() {
    return null;
}

/**
 * Reset after live verification (Key Inspector's fiber capture + Eval, same methodology that found
 * GuildsBar's bug) showed this file's original approach shares the exact same flaw: rawFind matching
 * a component by `.type.displayName`/`.type.name` across window.modules can - and here, does - match
 * a different, unrelated module than the one actually mounted. The visible symptom: Discord's real
 * QuestDockEnrolledHeader (and friends) kept running unpatched, then crashed reading properties off
 * the fake quest data useMobileQuestDock.ts hands out, because our replacement was silently mutating
 * the wrong object the whole time.
 *
 * registerTypeDetector sidesteps this the same way it does for GuildsBar: it inspects the `type`
 * argument passed directly to createElement/jsx at the moment something actually creates an element
 * with it, which is necessarily the real, live reference - there's no module-registry ambiguity
 * possible. registerIntercept then swaps that exact reference (matched by identity) for the
 * replacement on every future creation.
 */
export function patchExpanded(cleanups: (() => void)[]): boolean {
    registerTypeDetector(isNamed("QuestDockContentExpanded"), (real) => {
        registerIntercept(real, ServerDrawerSheetWrapper);
        console.log(TAG, "PATCH: found the real QuestDockContentExpanded, now rendering the drawer");
    });
    return true;
}

function ServerDrawerSheetWrapper() {
    return <ServerDrawerSheet gestureContext={getGestureContext()} />;
}

export function patchEmpty(name: string, cleanups: (() => void)[]): boolean {
    registerTypeDetector(isNamed(name), (real) => {
        registerIntercept(real, Nothing);
        console.log(TAG, `PATCH: found the real ${name}, now rendering nothing`);
    });
    return true;
}
