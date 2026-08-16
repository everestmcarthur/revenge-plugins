import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { TableRowGroup, TableSwitchRow } from "@shared/ui/table";

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <NoteBox>
                Messages over Discord's character limit (2000, or 4000 with Nitro) are split into
                multiple messages and sent in order automatically.
            </NoteBox>
            <TableRowGroup title="Splitting">
                <TableSwitchRow
                    label="Split on words instead of paragraphs"
                    subLabel="Off: keep paragraphs together where possible. On: split at any word boundary"
                    value={!!storage.splitOnWords}
                    onValueChange={(v: boolean) => { storage.splitOnWords = v; }}
                />
            </TableRowGroup>
        </SettingsScaffold>
    );
}
