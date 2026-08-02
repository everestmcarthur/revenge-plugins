/**
 * Reads React's internal fiber pointer directly off a native view instance and walks up to the
 * root, storing both under window.__serverDrawerFiberRoot/__serverDrawerFiberSelf for Eval scripts
 * to search afterward. Same technique Key Inspector's own Settings-screen capture uses, but kept
 * under separate globals - Key Inspector's capture only reaches whatever tree its own Settings
 * screen renders in (very likely a separate native modal/root from MainTabs' guild tab content),
 * so a capture point actually inside this plugin's own rendered output is what's needed to reach
 * anything under the Guilds tab (confirmed live: a Settings-screen capture couldn't find
 * QuestDockWithQuestContext at all, even navigating to the Guilds tab first).
 */
export function captureFiberRef(instance: any) {
    if (!instance) return;
    try {
        let fiber: any = null;

        if (instance._internalFiberInstanceHandleDEV) {
            fiber = instance._internalFiberInstanceHandleDEV;
        } else if (instance._internalInstanceHandle) {
            fiber = instance._internalInstanceHandle;
        } else if (instance.__internalInstanceHandle) {
            fiber = instance.__internalInstanceHandle;
        } else {
            const fiberKey = Object.keys(instance).find(
                (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
            );
            if (fiberKey) fiber = instance[fiberKey];
        }
        if (!fiber) return;

        if (fiber.return === undefined && fiber.child === undefined) {
            const nested = fiber.stateNode ?? fiber.fiber ?? fiber._debugOwner;
            if (nested && (nested.return !== undefined || nested.child !== undefined)) {
                fiber = nested;
            } else {
                return;
            }
        }

        let root = fiber;
        let guard = 0;
        while (root.return && guard < 5000) {
            root = root.return;
            guard++;
        }

        (window as any).__serverDrawerFiberRoot = root;
        (window as any).__serverDrawerFiberSelf = fiber;
    } catch {
        // Best-effort diagnostic capture - a failure here shouldn't affect the caller's own render.
    }
}
