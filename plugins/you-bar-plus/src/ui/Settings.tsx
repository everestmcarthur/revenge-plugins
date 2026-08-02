import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";

const { FormSection, FormSwitchRow } = Forms;

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <NoteBox>
                Fork of Purple-EyeZ's YouBar+, rebuilt from scratch after the original approach
                (patching YouBar's own notification button directly) turned out to be unreliable on
                current Discord builds. These buttons now render as an independent floating overlay
                near the bottom-right of the screen instead of natively inside the YouBar row itself
                - not pixel-identical placement, but should appear reliably and update instantly when
                toggled, without needing a restart.
            </NoteBox>
            <FormSection title="Buttons">
                <FormSwitchRow
                    label="Direct Messages button"
                    subLabel="Show a floating DM button"
                    value={!!storage.showDMButton}
                    onValueChange={(v: boolean) => {
                        storage.showDMButton = v;
                    }}
                />
                <FormSwitchRow
                    label="Settings button"
                    subLabel="Show a floating Settings button"
                    value={!!storage.showSettingsButton}
                    onValueChange={(v: boolean) => {
                        storage.showSettingsButton = v;
                    }}
                />
            </FormSection>
        </SettingsScaffold>
    );
}
