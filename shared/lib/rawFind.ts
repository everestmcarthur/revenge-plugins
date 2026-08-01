// Revenge's own metro finders (findByProps/findByName/findByTypeName/findByStoreName, and even
// the bare `find`) cache their result per search - including a NEGATIVE result. Once a search
// comes up empty, it's marked "not found" and every later call with the same search never
// rescans window.modules again, even after the real module registers (confirmed by reading
// Revenge's own source: metro/internals/modules.ts's getModules() returns early on a cached
// NOT_FOUND flag, before ever reaching the loop that walks currently-registered modules). That
// makes retry loops (this repo's waitFor/lazy helpers) pointless for any search whose first
// attempt happens to run before the target is registered - every retry after that first miss
// hits the same poisoned cache instead of actually looking again. This walks window.modules
// directly, bypassing that cache entirely, for use specifically inside retry loops.
//
// The module-exports cache below is shared across every call (not per-predicate) and only ever
// grows - each call only evaluates modules it hasn't seen before, reusing everything already
// pulled. Requiring every not-yet-loaded module in the bundle is inherently a one-time cost (the
// exact same cost Revenge's own finders pay on their first, uncached search), but paying it once
// and reusing the result is very different from paying it on every 200ms retry tick across
// several different patchers, which is what calling window.__r fresh every time would do.
declare const window: any;

const exportsCache = new Map<number, any>();

function scanNewModules(): void {
    const modules = window?.modules;
    if (!modules) return;

    for (const key in modules) {
        const id = Number(key);
        if (exportsCache.has(id)) continue;

        try {
            const exports = window.__r(id);
            if (exports) exportsCache.set(id, exports);
        } catch {
            // Some modules throw when required this early/out of order - skip and try again
            // next call, once whatever they depend on has loaded.
        }
    }
}

export function rawFind<T = any>(predicate: (exports: any) => boolean): T | undefined {
    scanNewModules();

    for (const exports of exportsCache.values()) {
        try {
            if (predicate(exports)) return exports;
            if (exports?.default != null && predicate(exports.default)) return exports.default;
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
