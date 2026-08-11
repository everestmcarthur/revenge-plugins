import { React } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";

export default function Settings() {
    return (
        <SettingsScaffold>
            <NoteBox>
                RosePlugs gathers Rosie's other plugins under their own "Rosie's Plugs" section in
                Settings, with a quick-install browser for anything not installed yet.
            </NoteBox>
        </SettingsScaffold>
    );
}
