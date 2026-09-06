import { React } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { TableRowGroup } from "@shared/ui/table";

export default function Settings() {
    return (
        <SettingsScaffold>
            <TableRowGroup title="Antied Zero">
                <NoteBox>
                    Antied Zero is active and running in zero-config mode. Deleted messages are automatically retained with ephemeral flags, and edit history is tracked in-line.
                </NoteBox>
            </TableRowGroup>
        </SettingsScaffold>
    );
}
