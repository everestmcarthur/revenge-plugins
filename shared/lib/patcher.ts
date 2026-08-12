export interface PluginLogger {
    error(message: string): void;
}

// Wraps a patch-application function so a single broken lookup only disables that one surface,
// instead of crashing the whole plugin's onLoad and taking every other patch down with it.
export function safePatch(pluginName: string, patchName: string, apply: () => () => void, logger: PluginLogger): () => void {
    try {
        return apply();
    } catch (e) {
        logger.error(`[${pluginName}] Failed to apply the "${patchName}" patch, that surface will be skipped: ${e}`);
        return () => {};
    }
}

/** Applies a named set of patches with safePatch and returns one combined unpatch function. */
export function applyPatches(pluginName: string, logger: PluginLogger, patches: Record<string, () => () => void>): () => void {
    const unpatches = Object.entries(patches).map(([name, apply]) => safePatch(pluginName, name, apply, logger));
    return () => unpatches.forEach((unpatch) => unpatch());
}
