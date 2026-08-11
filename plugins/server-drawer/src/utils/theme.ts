import { findByProps, findByStoreName } from "@vendetta/metro";

const Flux = findByProps("useStateFromStores");
const colors = findByProps("colors", "unsafe_rawColors")?.colors;
const ExpandedGuildFolderStore = findByStoreName("ExpandedGuildFolderStore");

export function useTheme() {
    return {
        text: colors?.TEXT_NORMAL ?? "#dbdee1",
        folder: "#5865f2",
        hover: colors?.STATE_LAYER_PRESS ?? "rgba(255,255,255,0.06)",
    };
}

export function useFolderExpanded(folderId: string | number): boolean {
    // Confirmed live: an account with folders and one without exercise different code paths (this
    // hook is only ever called by FolderItem, which only exists when there's a folder to render) -
    // an account with no folders rendered fine while one with folders showed nothing at all.
    // ExpandedGuildFolderStore is a one-shot findByStoreName at module-eval time with no retry, so
    // if it hadn't registered yet, this passed [undefined] into useStateFromStores - which throws
    // rather than returning safely, taking down the whole drawer render, not just this one folder.
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
