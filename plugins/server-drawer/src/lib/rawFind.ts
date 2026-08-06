// Self-contained on purpose - this plugin does not import from @shared/*. Revenge's own
// findByProps/findByName/findByTypeName/findByStoreName (and even the bare `find`) cache their
// result per search - including a NEGATIVE result. Once a search comes up empty, it's marked "not
// found" and every later call with the same search never rescans window.modules again, even after
// the real module registers (confirmed by reading Revenge's own source: metro/internals/modules.ts's
// getModules() returns early on a cached NOT_FOUND flag). That makes retry loops pointless for any
// search whose first attempt happens to run before the target is registered - every retry after
// that first miss hits the same poisoned cache instead of actually looking again.
//
// This walks window.modules directly to bypass that cache - but critically, it never forces a
// module to initialize (never calls window.__r on something that hasn't run yet). Metro only ever
// runs a module's factory once and caches whatever it produced forever, so force-evaluating one
// before its own dependencies are ready can permanently wedge it into a broken state for the rest
// of the session - no amount of retrying fixes that, since the factory never runs again. This only
// inspects modules Metro's own isInitialized flag says have already been required by something
// else, which is entirely passive and safe to poll repeatedly - it just waits for Discord's own
// code to naturally reach the module we want.
declare const window: any;

export function rawFind<T = any>(predicate: (exports: any) => boolean): T | undefined {
    const modules = window?.modules;
    if (!modules) return undefined;

    for (const id in modules) {
        const def = modules[id];
        if (!def?.isInitialized) continue;

        const exports = def.publicModule?.exports;
        if (!exports) continue;

        try {
            if (predicate(exports)) return exports;
            if (exports.default != null && predicate(exports.default)) return exports.default;
        } catch {
            // A predicate throwing on one module's shape shouldn't stop the scan.
        }
    }

    return undefined;
}

export function rawFindByTypeName<T = any>(name: string): T | undefined {
    return rawFind<T>((m) => m?.name === name || m?.displayName === name || m?.type?.name === name || m?.type?.displayName === name);
}

export function rawFindByName<T = any>(name: string): T | undefined {
    return rawFind<T>((m) => m?.name === name || m?.displayName === name);
}

export function rawFindByProps<T = any>(...props: string[]): T | undefined {
    return rawFind<T>((m) => props.every((p) => m?.[p] !== undefined));
}

/**
 * Same as rawFindByProps, but additionally requires every named property to be a function - not
 * just "defined." Confirmed live (Key Inspector's Eval console, direct window.modules scan) that
 * plain rawFindByProps can and does match a completely unrelated module whose properties happen to
 * share the same names as the real hook/utility functions being searched for, but hold non-function
 * values (e.g. a type-shape/declaration-style object) - and since window.modules iterates in
 * ascending numeric id order, a lower-id decoy module reliably wins over the real, higher-id
 * implementation *every single time*, not occasionally. This was confirmed to be the actual cause
 * of the Quest Dock hijack's unreliability: rawFindByProps("useMobileQuestDock") was silently
 * patching an object-shaped decoy at a lower module id instead of the real hook. Use this whenever
 * what's being searched for is specifically a function (hooks, utility functions), not just any
 * export with that name.
 */
export function rawFindByFunctionProps<T = any>(...props: string[]): T | undefined {
    return rawFind<T>((m) => props.every((p) => typeof m?.[p] === "function"));
}

/**
 * Same idea as rawFindByFunctionProps, but for properties whose real value is an object/enum, not
 * a function (e.g. ReadStateTypes, HapticFeedbackTypes) - "is it a function" can't discriminate
 * those from the same decoy module rawFindByFunctionProps was built for, since the decoy's version
 * is *also* an object. Confirmed live that the decoy's enum-shaped properties don't hold the real
 * values (e.g. its ReadStateTypes/UnreadSetting come back null/empty on direct access, despite
 * matching a plain "property exists" check) - so this instead requires each named property to pass
 * its own validator against a value only the real implementation would actually have, e.g.:
 * rawFindByValidProps({ ReadStateTypes: (v) => v?.CHANNEL !== undefined }).
 */
export function rawFindByValidProps<T = any>(validators: Record<string, (value: any) => boolean>): T | undefined {
    const props = Object.keys(validators);
    return rawFind<T>((m) => props.every((p) => {
        try {
            return validators[p](m?.[p]);
        } catch {
            return false;
        }
    }));
}

// Matches Revenge's own byStoreName filter (metro/filters.ts): a zero-arg getName() returning
// the store's name.
export function rawFindByStoreName<T = any>(name: string): T | undefined {
    return rawFind<T>((m) => typeof m?.getName === "function" && m.getName.length === 0 && m.getName() === name);
}
