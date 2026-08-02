import { findByProps } from "@vendetta/metro";
import { rawFindByTypeName } from "@shared/lib/rawFind";

declare const window: any;

const WORK_TAGS: Record<number, string> = {
    0: "FunctionComponent", 1: "ClassComponent", 3: "HostRoot", 5: "HostComponent",
    6: "HostText", 7: "Fragment", 8: "Mode", 9: "ContextConsumer", 10: "ContextProvider",
    11: "ForwardRef", 13: "SuspenseComponent", 14: "MemoComponent", 15: "SimpleMemoComponent"
};

function tagName(tag: number): string {
    return WORK_TAGS[tag] ?? `tag ${tag}`;
}

/**
 * Diagnoses exactly why forceRerender isn't making YouBar+'s buttons show up live, instead of
 * guessing again from decompiled source with no device to check against. Every step is
 * independently reported so a single failed assumption doesn't hide whether everything after it
 * would've worked - e.g. "component not found" vs "found, but no fiber roots" vs "fiber found, but
 * zero class-component ancestors" are very different bugs with very different fixes.
 */
export function runYouBarDiagnostics(): string {
    const lines: string[] = [`YouBar+ diagnostics - ${new Date().toISOString()}`, ""];

    // Step 1: is the component itself findable right now?
    const target = rawFindByTypeName("YouBarNotificationsButton");
    lines.push(`1. rawFindByTypeName("YouBarNotificationsButton") -> ${target ? "FOUND" : "NOT FOUND"}`);
    if (target) {
        lines.push(`   typeof target = ${typeof target}`);
        lines.push(`   has .type (inner render fn) = ${typeof target?.type === "function"}`);
        lines.push(`   has .compare = ${"compare" in (target ?? {})}`);
        lines.push(`   $$typeof = ${String(target?.$$typeof ?? "none")}`);
    }
    lines.push("");

    // Step 2: does the devtools hook exist at all, and does it know about any renderers?
    const hook = window?.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    lines.push(`2. window.__REACT_DEVTOOLS_GLOBAL_HOOK__ -> ${hook ? "present" : "MISSING"}`);
    if (hook) {
        lines.push(`   typeof getFiberRoots = ${typeof hook.getFiberRoots}`);
        lines.push(`   renderers = ${hook.renderers ? `Map(${hook.renderers.size ?? "?"})` : "MISSING"}`);
    }
    lines.push("");

    // Step 3: for each renderer, how many fiber roots does it report, and can we find our target
    // fiber by walking them?
    let foundFiber: any = null;
    if (hook?.getFiberRoots && hook?.renderers?.keys && target) {
        let rendererCount = 0;
        for (const rendererID of hook.renderers.keys()) {
            rendererCount++;
            let roots: Set<any> | undefined;
            try {
                roots = hook.getFiberRoots(rendererID);
            } catch (e) {
                lines.push(`3. renderer ${rendererID}: getFiberRoots threw: ${e}`);
                continue;
            }
            lines.push(`3. renderer ${rendererID}: ${roots ? roots.size : 0} fiber root(s)`);
            if (roots) {
                for (const root of roots) {
                    if (!foundFiber) foundFiber = findFiberByType(root.current, target);
                }
            }
        }
        if (rendererCount === 0) lines.push("3. hook.renderers is empty - React never registered with it");
    } else {
        lines.push("3. skipped (no hook, no renderers, or component not found in step 1)");
    }
    lines.push(`   target fiber found by tree walk -> ${foundFiber ? "YES" : "NO"}`);
    lines.push("");

    // Step 4: if we found the fiber, walk every ancestor and report its type - this is the actual
    // question forceRerender's bump() depends on: does a class component exist anywhere above us?
    if (foundFiber) {
        lines.push("4. Ancestor chain from target fiber up to root:");
        let node = foundFiber;
        let depth = 0;
        let sawClassComponent = false;
        while (node && depth < 60) {
            const hasForceUpdate = typeof node.stateNode?.forceUpdate === "function";
            if (hasForceUpdate) sawClassComponent = true;
            lines.push(`   [${depth}] ${tagName(node.tag)}${hasForceUpdate ? " <- has forceUpdate()" : ""}`);
            node = node.return;
            depth++;
        }
        lines.push(`   class-component ancestor with forceUpdate found -> ${sawClassComponent ? "YES" : "NO"}`);
    } else {
        lines.push("4. skipped (no fiber found in step 3)");
    }
    lines.push("");

    // Step 5: the fallback mechanism - can we force an update via a genuine, public navigation
    // no-op instead of walking fiber internals at all?
    const navModule = findByProps("getRootNavigationRef");
    lines.push(`5. findByProps("getRootNavigationRef") -> ${navModule ? "FOUND" : "NOT FOUND"}`);
    if (navModule) {
        try {
            const navRef = navModule.getRootNavigationRef?.();
            lines.push(`   getRootNavigationRef() -> ${navRef ? "returned a ref" : "null/undefined"}`);
            if (navRef) {
                lines.push(`   typeof isReady = ${typeof navRef.isReady}`);
                lines.push(`   isReady() = ${(() => { try { return navRef.isReady?.(); } catch (e) { return `threw: ${e}`; } })()}`);
                lines.push(`   typeof getCurrentRoute = ${typeof navRef.getCurrentRoute}`);
                const route = (() => { try { return navRef.getCurrentRoute?.(); } catch { return undefined; } })();
                lines.push(`   getCurrentRoute() -> ${route ? JSON.stringify({ name: route.name, params: route.params }) : "none"}`);
                lines.push(`   typeof navigate = ${typeof navRef.navigate}`);
                lines.push(`   typeof setParams = ${typeof navRef.setParams}`);
            }
        } catch (e) {
            lines.push(`   threw: ${e}`);
        }
    }

    return lines.join("\n");
}

/** Same shape as forceRerender.ts's own walk - kept identical on purpose so this reports the truth. */
function findFiberByType(root: any, target: any): any {
    const stack = root ? [root] : [];
    let guard = 0;
    while (stack.length) {
        if (++guard > 200_000) return null;
        const fiber = stack.pop();
        if (!fiber) continue;
        if (fiber.type === target || fiber.elementType === target) return fiber;
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
}
