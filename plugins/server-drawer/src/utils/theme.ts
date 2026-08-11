import { lazy } from "../lib/lazy";
import { rawFindByStoreName } from "../lib/rawFind";
import { getFlux, getColorModule } from "../lib/commonModules";

const getExpandedGuildFolderStore = lazy(() => rawFindByStoreName("ExpandedGuildFolderStore"));

export function useTheme() {
    const colors = getColorModule()?.colors;
    return {
        text: colors?.TEXT_NORMAL ?? colors?.TEXT_DEFAULT ?? "#dbdee1",
        folder: "#5865f2",
        hover: colors?.STATE_LAYER_PRESS ?? "rgba(255,255,255,0.06)",
    };
}

export function useFolderExpanded(folderId: string | number): boolean {
    const Flux = getFlux();
    const ExpandedGuildFolderStore = getExpandedGuildFolderStore();
    // Guards against an undefined store, not just a falsy return value - confirmed live that
    // passing [undefined] into useStateFromStores throws rather than failing safely, which used to
    // take the whole drawer down (this only ever runs when there's an actual folder to render, so
    // an account with folders showed nothing at all while one without rendered fine).
    if (!Flux?.useStateFromStores || !ExpandedGuildFolderStore) return false;
    return Flux.useStateFromStores(
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
