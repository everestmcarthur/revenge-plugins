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
                Fork of Purple-EyeZ's YouBar+, ported to Revenge's Vendetta-compat API. Like the
                original, this patches the YouBar the moment it loads - if you enable it while
                Discord's already running, you may need to restart once for the buttons to appear.
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
