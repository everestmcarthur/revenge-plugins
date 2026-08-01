import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import patchChat from "./patches/chat";
import patchDetails from "./patches/details";
import patchName from "./patches/name";
import patchTag from "./patches/tag";
import Settings from "./ui/pages/Settings";

let patches: (() => void)[] = [];

// Discord occasionally renames/removes the internals a single surface (chat, member list, etc.)
// depends on. Isolating each patch means one broken lookup only disables that surface instead of
// taking the whole plugin down, which is what happened to the old build of this plugin.
function safePatch(name: string, apply: () => () => void): () => void {
    try {
        return apply();
    } catch (e) {
        logger.error(`[Staff Tags] Failed to apply the "${name}" patch, that surface will be skipped: ${e}`);
        return () => {};
    }
}

export default {
    onLoad: () => {
        storage.useRoleColor ??= false;
        storage.tags ??= {};

        patches = [
            safePatch("tag", patchTag),
            safePatch("chat", patchChat),
            safePatch("name", patchName),
            safePatch("details", patchDetails)
        ];
    },
    onUnload: () => patches.forEach((unpatch) => unpatch()),
    settings: Settings
};
