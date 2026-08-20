import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { zStorage } from "../lib/api";

export default function Settings() {
    useProxy(storage);
    const z = zStorage();

    return (
        <SettingsScaffold>
            <NoteBox>
                Requires a Zipline API token (Zipline dashboard - Account Settings - copy your token).
                Nothing is sent anywhere until a token is set below. Don't have your own Zipline?
                Create an account at i.allyapp.cc and register with your Discord.
            </NoteBox>
            <TableRowGroup title="Server">
                <TextInput
                    label="Zipline host"
                    placeholder="i.allyapp.cc"
                    value={z.host ?? ""}
                    onChange={(v: string) => { z.host = v; }}
                />
                <TextInput
                    label="API token"
                    placeholder="paste your token here"
                    value={z.token ?? ""}
                    onChange={(v: string) => { z.token = v; }}
                />
            </TableRowGroup>
            <TableRowGroup title="Behavior">
                <TableSwitchRow
                    label="Auto-upload attachments"
                    subLabel="After sending a file, it's re-uploaded to Zipline, the original message is deleted, and replaced with a new message containing just the Zipline link (copied to your clipboard)"
                    value={!!z.autoUpload}
                    onValueChange={(v: boolean) => { z.autoUpload = v; }}
                />
                <TableSwitchRow
                    label="Auto-shorten links"
                    subLabel="After sending a message, links in it get replaced with Zipline short links via an edit"
                    value={!!z.autoShorten}
                    onValueChange={(v: boolean) => { z.autoShorten = v; }}
                />
            </TableRowGroup>
        </SettingsScaffold>
    );
}
