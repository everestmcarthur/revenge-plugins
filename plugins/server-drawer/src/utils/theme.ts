import { lazy } from "../lib/lazy";
import { rawFindByStoreName } from "../lib/rawFind";
import { getFlux, getColorModule } from "../lib/commonModules";

// getFlux/getColorModule come from lib/commonModules.ts - see that file for the decoy-module
// writeup. ExpandedGuildFolderStore switches from an eager, module-load-time findByStoreName (the
// caching finder, permanently wrong if it runs before the store module has registered) to lazy +
// rawFindByStoreName for the same timing reason established elsewhere in this plugin.
const getExpandedGuildFolderStore = lazy(() => rawFindByStoreName("ExpandedGuildFolderStore"));

export function useTheme() {
    const colors = getColorModule()?.colors;
    return {
        text: colors?.TEXT_NORMAL ?? "#dbdee1",
        folder: "#5865f2",
        hover: colors?.STATE_LAYER_PRESS ?? "rgba(255,255,255,0.06)",
    };
}

export function useFolderExpanded(folderId: string | number): boolean {
    const Flux = getFlux();
    const ExpandedGuildFolderStore = getExpandedGuildFolderStore();
    return Flux?.useStateFromStores?.(
        [ExpandedGuildFolderStore],
        () => {
            const folders = ExpandedGuildFolderStore?.getExpandedFolders?.();
            return folders instanceof Set ? folders.has(folderId) : false;
        },
        [folderId],
    ) ?? false;
}

export interface GuildNode {
    type: string;
    id: string | number;
    name?: string;
    color?: number | null;
    expanded?: boolean;
    children: GuildNode[];
}
