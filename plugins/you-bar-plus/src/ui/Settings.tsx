import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { updateYouBar } from "../patches/youBarButtons";


export default function Settings() {
    useProxy(storage);

    // Also force one last re-render on the way out, in case a tap didn't reach a mounted YouBar.
    React.useEffect(() => () => updateYouBar(), []);

    return (
        <SettingsScaffold>
            <NoteBox>
                Fork of Purple-EyeZ's YouBar+, ported to Revenge's Vendetta-compat API. Like the
                original, this patches the YouBar the moment it loads - if you enable it while
                Discord's already running, you may need to restart once for the buttons to appear.
                Inbox categorization is merged in from shin's BetterInbox (fshinz/Revenge-Plugins),
                with permission, so both features share one patch instead of two conflicting ones.
            </NoteBox>
            <TableRowGroup title="Buttons">
                <TableSwitchRow
                    label="Direct Messages button"
                    subLabel="Show the DM button in the YouBar"
                    value={!!storage.showDMButton}
                    onValueChange={(v: boolean) => {
                        storage.showDMButton = v;
                        updateYouBar();
                    }}
                />
                <TableSwitchRow
                    label="Inbox button"
                    subLabel="Show a categorized mentions/replies/reactions inbox in the YouBar - requires a restart to take effect"
                    value={!!storage.showInboxButton}
                    onValueChange={(v: boolean) => {
                        storage.showInboxButton = v;
                        updateYouBar();
                    }}
                />
                <TableSwitchRow
                    label="Settings button"
                    subLabel="Show the Settings button in the YouBar"
                    value={!!storage.showSettingsButton}
                    onValueChange={(v: boolean) => {
                        storage.showSettingsButton = v;
                        updateYouBar();
                    }}
                />
            </TableRowGroup>
        </SettingsScaffold>
    );
}
