import { React, clipboard } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { TableRow, TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import { getLog, clearLog } from "../lib/store";
import {
    cloudSyncStorage,
    deleteRemoteLog,
    disconnect,
    isConnected,
    openOauth2Modal,
    syncNow,
} from "../lib/cloudSync";
import openLogViewer from "./LogViewerPage";

function formatLastSynced(at: number | undefined): string {
    if (!at) return "Never synced";

    const mins = Math.round((Date.now() - at) / 60000);
    if (mins < 1) return "Synced just now";
    if (mins < 60) return `Synced ${mins}m ago`;

    const hours = Math.round(mins / 60);
    if (hours < 24) return `Synced ${hours}h ago`;

    return `Synced ${Math.round(hours / 24)}d ago`;
}

export default function Settings() {
    useProxy(storage);
    const o = storage.options;
    const cloud = cloudSyncStorage();
    useProxy(cloud);

    return (
        <SettingsScaffold>
            <NoteBox>
                Deleted messages are kept visible in the chat (styled like a deletion, the way
                Equicord's MessageLogger looks on desktop) whenever possible. Everything is also
                saved to a searchable log that survives Discord reloads, since keeping a message
                in the live chat only lasts until the app actually restarts and re-fetches history.
            </NoteBox>

            <TableRowGroup title="What to capture">
                <TableSwitchRow
                    label="Log deleted messages"
                    value={!!o.logDeleted}
                    onValueChange={(v: boolean) => { o.logDeleted = v; }}
                />
                <TableSwitchRow
                    label="Keep deleted messages in the chat"
                    subLabel="Off: only saved to the log below, removed from chat immediately like normal. Large bulk deletes (e.g. a bot purge) are always just logged, never kept inline"
                    value={!!o.keepDeletedInline}
                    onValueChange={(v: boolean) => { o.keepDeletedInline = v; }}
                />
                <TableSwitchRow
                    label="Log edited messages"
                    value={!!o.logEdited}
                    onValueChange={(v: boolean) => { o.logEdited = v; }}
                />
            </TableRowGroup>

            <TableRowGroup title="Ignore">
                <TableSwitchRow
                    label="Ignore bots"
                    value={!!o.ignoreBots}
                    onValueChange={(v: boolean) => { o.ignoreBots = v; }}
                />
                <TableSwitchRow
                    label="Ignore your own messages"
                    value={!!o.ignoreOwnMessages}
                    onValueChange={(v: boolean) => { o.ignoreOwnMessages = v; }}
                />
                <TableSwitchRow
                    label="Ignore your own edits"
                    subLabel="Only applies if 'ignore your own messages' above is off"
                    value={!!o.ignoreOwnEdits}
                    onValueChange={(v: boolean) => { o.ignoreOwnEdits = v; }}
                />
                <TableSwitchRow
                    label="Ignore DMs"
                    value={!!o.ignoreDMs}
                    onValueChange={(v: boolean) => { o.ignoreDMs = v; }}
                />
                <TextInput
                    label="Ignored channel IDs"
                    placeholder="comma-separated"
                    value={o.ignoredChannelIds}
                    onChange={(v: string) => { o.ignoredChannelIds = v; }}
                />
                <TextInput
                    label="Ignored server IDs"
                    placeholder="comma-separated"
                    value={o.ignoredGuildIds}
                    onChange={(v: string) => { o.ignoredGuildIds = v; }}
                />
                <TextInput
                    label="Ignored user IDs"
                    placeholder="comma-separated"
                    value={o.ignoredUserIds}
                    onChange={(v: string) => { o.ignoredUserIds = v; }}
                />
                <TextInput
                    label="Ignored keywords"
                    subLabel="Comma-separated - skips logging any message containing one of these"
                    placeholder="e.g. password, secret"
                    value={o.ignoredKeywords}
                    onChange={(v: string) => { o.ignoredKeywords = v; }}
                />
            </TableRowGroup>

            <TableRowGroup title="Log limits">
                <TextInput
                    label="Max total entries"
                    subLabel="Oldest entries are dropped once this is exceeded - 0 for unlimited"
                    value={o.maxEntries}
                    onChange={(v: string) => { o.maxEntries = v; }}
                />
                <TextInput
                    label="Max entries per channel"
                    subLabel="0 for unlimited"
                    value={o.maxEntriesPerChannel}
                    onChange={(v: string) => { o.maxEntriesPerChannel = v; }}
                />
                <TextInput
                    label="Max age (days)"
                    subLabel="0 for unlimited"
                    value={o.maxAgeDays}
                    onChange={(v: string) => { o.maxAgeDays = v; }}
                />
            </TableRowGroup>

            <TableRowGroup title="Cloud sync">
                <NoteBox>
                    Off by default. When on, your log (subject to the same limits above) is sent to a
                    server so it survives reinstalls and syncs between devices - nothing else in this
                    plugin leaves your device.
                </NoteBox>
                <TableSwitchRow
                    label="Enable cloud sync"
                    value={!!cloud.enabled}
                    onValueChange={(v: boolean) => { cloud.enabled = v; }}
                />
                {cloud.enabled && !isConnected() && (
                    <TableRow label="Connect Discord account" onPress={() => openOauth2Modal()} />
                )}
                {cloud.enabled && isConnected() && (
                    <>
                        <TableRow
                            label={formatLastSynced(cloud.lastSyncedAt)}
                            subLabel="Tap to sync now"
                            onPress={async () => {
                                showToast("Syncing…", undefined);
                                showToast(await syncNow() ? "Synced" : "Sync failed", undefined);
                            }}
                        />
                        <TableRow
                            label="Disconnect"
                            subLabel="Stops syncing - what's already on the server is kept"
                            onPress={() => {
                                disconnect();
                                showToast("Disconnected", undefined);
                            }}
                        />
                        <TableRow
                            label="Delete cloud data"
                            subLabel="Permanently removes your synced log from the server"
                            onPress={async () => {
                                showToast(await deleteRemoteLog() ? "Cloud data deleted" : "Failed to delete cloud data", undefined);
                            }}
                        />
                    </>
                )}
                <TextInput
                    label="Custom server URL"
                    subLabel="Point at your own self-hosted instance instead - leave blank for the default"
                    placeholder="https://your-worker.workers.dev"
                    value={cloud.customHost ?? ""}
                    onChange={(v: string) => { cloud.customHost = v; }}
                />
                <TextInput
                    label="Custom OAuth2 client ID"
                    subLabel="Only needed alongside a custom server above"
                    value={cloud.customClientId ?? ""}
                    onChange={(v: string) => { cloud.customClientId = v; }}
                />
            </TableRowGroup>

            <TableRowGroup title="Log">
                <TableRow label="View log" onPress={() => openLogViewer()} />
                <TableRow
                    label="Copy entire log as JSON"
                    onPress={() => {
                        const log = getLog();
                        clipboard.setString(JSON.stringify(log, null, 2));
                        showToast(`Copied ${log.length} log entr${log.length === 1 ? "y" : "ies"} to clipboard`, undefined);
                    }}
                />
            </TableRowGroup>

            <PrimaryButton
                label="Clear entire log"
                onPress={() => {
                    const count = getLog().length;
                    clearLog();
                    showToast(`Cleared ${count} log entr${count === 1 ? "y" : "ies"}`, undefined);
                }}
                style={{ margin: 16, backgroundColor: "#F23F42" }}
            />
        </SettingsScaffold>
    );
}
