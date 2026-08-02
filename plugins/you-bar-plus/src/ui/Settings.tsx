import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { updateYouBar } from "../patches/youBarButtons";

const { FormSection, FormSwitchRow } = Forms;

export default function Settings() {
    useProxy(storage);

    // Also force one last re-render on the way out, in case a tap didn't reach a mounted YouBar.
    React.useEffect(() => () => updateYouBar(), []);

    return (
        <SettingsScaffold>
            <NoteBox>
                Fork of Purple-EyeZ's YouBar+, ported to Revenge's Vendetta-compat API, with a fix
                for a startup race where Metro hadn't always registered the YouBar component yet by
                the time this patch ran - if you toggle this on while Discord's already running,
                the buttons should still appear without a restart once they mount, but a fresh
                reload is the most reliable way to see them.
            </NoteBox>
            <FormSection title="Buttons">
                <FormSwitchRow
                    label="Direct Messages button"
                    subLabel="Show the DM button in the YouBar"
                    value={!!storage.showDMButton}
                    onValueChange={(v: boolean) => {
                        storage.showDMButton = v;
                        updateYouBar();
                    }}
                />
                <FormSwitchRow
                    label="Settings button"
                    subLabel="Show the Settings button in the YouBar"
                    value={!!storage.showSettingsButton}
                    onValueChange={(v: boolean) => {
                        storage.showSettingsButton = v;
                        updateYouBar();
                    }}
                />
            </FormSection>
        </SettingsScaffold>
    );
}
