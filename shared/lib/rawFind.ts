// Revenge's own metro finders (findByProps/findByName/findByTypeName/findByStoreName, and even
// the bare `find`) cache their result per search - including a NEGATIVE result. Once a search
// comes up empty, it's marked "not found" and every later call with the same search never
// rescans window.modules again, even after the real module registers (confirmed by reading
// Revenge's own source: metro/internals/modules.ts's getModules() returns early on a cached
// NOT_FOUND flag). That makes retry loops pointless for any search whose first attempt happens
// to run before the target is registered - every retry after that first miss hits the same
// poisoned cache instead of actually looking again.
//
// This walks window.modules directly to bypass that cache - but critically, it never forces a
// module to initialize (never calls window.__r on something that hasn't run yet). An earlier
// version of this file did force-require everything on every scan, which is genuinely dangerous:
// Metro only ever runs a module's factory once and caches whatever it produced forever, so
// force-evaluating a module before whatever it depends on on is actually ready can permanently
// wedge it into a broken state for the rest of the session - no amount of retrying fixes that,
// since the factory never runs again. This only inspects modules Metro's own isInitialized flag
// says have ALREADY been required by something else, which is entirely passive and safe to poll
// repeatedly - it just waits for Discord's own code to naturally reach the module we want.
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

// Matches Revenge's own byStoreName filter (metro/filters.ts): a zero-arg getName() returning
// the store's name.
export function rawFindByStoreName<T = any>(name: string): T | undefined {
    return rawFind<T>((m) => typeof m?.getName === "function" && m.getName.length === 0 && m.getName() === name);
}
