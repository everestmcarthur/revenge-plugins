// Revenge's own finders cache a negative result forever, so retry loops never see a module that
// registers after the first miss. This walks window.modules directly instead, and only inspects
// modules already marked isInitialized - never force-requires one, which can wedge Metro.
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
