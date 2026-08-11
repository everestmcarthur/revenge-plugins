import { React } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { showToast } from "@vendetta/ui/toasts";
import { clearNexusCache } from "../lib/nexusApi";

export default function Settings() {
    return (
        <SettingsScaffold>
            <NoteBox>
                RosePlugs gathers Rosie's other plugins under their own "Rosie's Plugs" section in
                Settings, with a quick-install browser for anything not installed yet.
            </NoteBox>
            <PrimaryButton
                label="Refresh plugin list"
                onPress={() => {
                    clearNexusCache();
                    showToast("Plugin list will refresh next time you open Plugins");
                }}
                style={{ margin: 16 }}
            />
        </SettingsScaffold>
    );
}
