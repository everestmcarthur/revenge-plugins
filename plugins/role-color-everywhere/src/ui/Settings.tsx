import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <TableRowGroup title="Where to show the top role color">
                <TableSwitchRow
                    label="Typing indicator"
                    subLabel='Color names in the "X is typing..." bar'
                    value={!storage.hideTyping}
                    onValueChange={(v: boolean) => { storage.hideTyping = !v; }}
                />
                <TableSwitchRow
                    label="Mentions"
                    subLabel="Color @mentions in chat messages"
                    value={!storage.noMention}
                    onValueChange={(v: boolean) => { storage.noMention = !v; }}
                />
                <TableSwitchRow
                    label="Member list role headers"
                    subLabel="Color the role section headers in the member list"
                    value={!storage.noRole}
                    onValueChange={(v: boolean) => { storage.noRole = !v; }}
                />
                <TableSwitchRow
                    label="Voice channel participant names"
                    value={!storage.noVoice}
                    onValueChange={(v: boolean) => { storage.noVoice = !v; }}
                />
                <TableSwitchRow
                    label="Message text"
                    subLabel="Tints message text toward the author's role color - disables text selection on tinted messages"
                    value={storage.chatInterpolation > 0}
                    onValueChange={(v: boolean) => { storage.chatInterpolation = v ? 60 : 0; }}
                />
                {storage.chatInterpolation > 0 && (
                    <TextInput
                        label="Message text strength (0-100)"
                        value={String(storage.chatInterpolation)}
                        keyboardType="numeric"
                        onChange={(v: string) => {
                            storage.chatInterpolation = Math.max(0, Math.min(100, Number(v) || 0));
                        }}
                    />
                )}
            </TableRowGroup>
            <NoteBox>
                Some of these surfaces (especially the member list headers) rely on component internals
                Discord doesn't officially expose, so a future Discord update may silently turn one of
                these off again - the rest will keep working if that happens.
            </NoteBox>
        </SettingsScaffold>
    );
}
