import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";

// Adapted from fres621's BetterFolders (autoCollapse.ts) - ported as a ServerDrawer feature
// instead of a standalone plugin because BetterFolders' other half (hideIcons) patches a
// "GuildContainer" component that no longer exists in current Discord builds at all, and its
// icon-collapsing behavior only made sense for the native server rail, which ServerDrawer already
// replaces. This half doesn't touch that component - it only reacts to the same folder-expand
// store/event ServerDrawer's own FolderItem already uses, so it works standalone here.
export function patchAutoCollapseFolders(cleanups: (() => void)[]): boolean {
    const ExpandedGuildFolderStore = findByStoreName("ExpandedGuildFolderStore");
    if (!ExpandedGuildFolderStore?.getExpandedFolders) return false;

    const listener = ({ folderId }: { folderId?: string | number }) => {
        if (!storage.autoCollapseFolders || folderId == null) return;

        const expanded = ExpandedGuildFolderStore.getExpandedFolders();
        if (!(expanded instanceof Set) || !expanded.has(folderId)) return;

        for (const id of expanded) {
            if (id !== folderId) {
                FluxDispatcher.dispatch({ type: "TOGGLE_GUILD_FOLDER_EXPAND", folderId: id });
            }
        }
    };

    FluxDispatcher.subscribe("TOGGLE_GUILD_FOLDER_EXPAND", listener);
    cleanups.push(() => FluxDispatcher.unsubscribe("TOGGLE_GUILD_FOLDER_EXPAND", listener));
    return true;
}
