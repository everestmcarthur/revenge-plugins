import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow } from "@shared/ui/table";
import SettingsScaffold from "./SettingsScaffold";
import NoteBox from "./NoteBox";
import { restart } from "../index";


export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <NoteBox>
                Server Drawer takes over the Quest Dock (the strip above the tab bar) to show your
                servers as a grid instead - tap to expand, long-press a server for its usual context
                menu, the chat bubble jumps to DMs, the + button creates or joins a server through
                Discord's own modal, and the check button marks every channel in every server as read.
            </NoteBox>
            <TableRowGroup title="Layout">
                <TableSwitchRow
                    label="Hide the left server rail"
                    subLabel="Your servers and DMs already live in the drawer, so the rail is redundant"
                    value={storage.hideGuildsBar !== false}
                    onValueChange={(v: boolean) => {
                        storage.hideGuildsBar = v;
                        restart();
                    }}
                />
                <TableSwitchRow
                    label="Unread badges"
                    subLabel="Show mention counts and unread dots on server icons in the drawer"
                    value={storage.showUnreadBadges !== false}
                    onValueChange={(v: boolean) => { storage.showUnreadBadges = v; }}
                />
                <TableSwitchRow
                    label="Show server names"
                    subLabel="Word-wrapped name below each server's icon"
                    value={storage.showGuildNames !== false}
                    onValueChange={(v: boolean) => { storage.showGuildNames = v; }}
                />
                <TableSwitchRow
                    label="Hide the DMs tile"
                    subLabel="Remove the DMs tile from the drawer entirely"
                    value={!!storage.hideDmTile}
                    onValueChange={(v: boolean) => { storage.hideDmTile = v; }}
                />
            </TableRowGroup>
            <TableRowGroup title="Folders">
                <TableSwitchRow
                    label="Auto-collapse other folders"
                    subLabel="Opening a folder collapses any other folder that was already open"
                    value={!!storage.autoCollapseFolders}
                    onValueChange={(v: boolean) => { storage.autoCollapseFolders = v; }}
                />
                <TableSwitchRow
                    label="Hide icons in collapsed folders"
                    subLabel="Show a plain folder icon instead of a 4-server preview"
                    value={!!storage.hideFolderIcons}
                    onValueChange={(v: boolean) => { storage.hideFolderIcons = v; }}
                />
            </TableRowGroup>
            <NoteBox>
                The folder options above are ported from fres621's BetterFolders - its other half
                (hiding icons in the native left server rail) patched a component that no longer
                exists in current Discord builds, so it's been rebuilt here instead, where it
                actually applies to what you see.
            </NoteBox>
        </SettingsScaffold>
    );
}
