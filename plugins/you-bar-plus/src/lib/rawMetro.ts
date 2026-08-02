// Self-contained on purpose - this plugin does not import from @shared/*. Revenge's own
// findByProps/findByName/findByTypeName/findByStoreName permanently cache a negative result the
// first time a search comes up empty and never rescan window.modules again, which makes any
// retry loop built on top of them pointless if the first attempt runs before the target registers.
// This reads window.modules directly instead, but - critically - never forces a module to
// initialize (never calls window.__r on something that hasn't run yet): Metro only ever runs a
// module's factory once and caches whatever it produced forever, so force-evaluating one before its
// own dependencies are ready can permanently wedge it into a broken state for the rest of the
// session. Only ever inspects modules Metro's own isInitialized flag says have already been
// required by something else - entirely passive, safe to poll repeatedly.
declare const window: any;

/**
 * Matches Revenge's own byFilePath filter (metro/filters.ts: metroModules[id].__filePath === path)
 * - confirmed live via Key Inspector's Eval console that this reads a real property Metro attaches
 * to every module's definition at registration time, well before that module has ever been
 * required. Revenge's own compat layer (window.vendetta, everything this repo builds against)
 * doesn't expose this filter, but since it's just a plain property read off window.modules[id],
 * there's nothing to import - it works the same read directly.
 *
 * Unlike name-based matching (findByTypeName and friends), a file path can't collide with an
 * unrelated module that happens to share a function name after minification - it's the literal
 * source file Discord's own build attached, tied to exactly one module.
 *
 * Still requires the module to be isInitialized to return its exports (the __filePath id lookup
 * itself doesn't need that, but there's nothing to hand back until the factory has actually run).
 */
export function rawFindByFilePath<T = any>(path: string, exportDefault = true): T | undefined {
    const modules = window?.modules;
    if (!modules) return undefined;

    for (const id in modules) {
        const def = modules[id];
        if (def?.__filePath !== path) continue;
        if (!def.isInitialized) return undefined;

        const exports = def.publicModule?.exports;
        if (!exports) return undefined;

        return exportDefault ? (exports.default ?? exports) : exports;
    }

    return undefined;
}
