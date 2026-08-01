import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { updateYouBar, YOU_BAR_BUTTON_CHOICES, YOU_BAR_BUTTON_LABELS, type YouBarButtonAction } from "../patches/youBarButtons";

const { FormSection, FormRow } = Forms;

function nextChoice(current: YouBarButtonAction): YouBarButtonAction {
    const idx = YOU_BAR_BUTTON_CHOICES.indexOf(current);
    return YOU_BAR_BUTTON_CHOICES[(idx + 1) % YOU_BAR_BUTTON_CHOICES.length];
}

function SlotRow({ label, slotKey }: { label: string; slotKey: "slot1" | "slot2" }) {
    const value: YouBarButtonAction = storage[slotKey];

    return (
        <FormRow
            label={label}
            subLabel={YOU_BAR_BUTTON_LABELS[value]}
            onPress={() => {
                storage[slotKey] = nextChoice(value);
                updateYouBar();
            }}
        />
    );
}

export default function Settings() {
    useProxy(storage);

    // Also force one last re-render on the way out, in case a tap didn't reach a mounted YouBar.
    React.useEffect(() => () => updateYouBar(), []);

    return (
        <SettingsScaffold>
            <NoteBox>
                YouBar+ adds up to 2 buttons to the YouBar - the row with your avatar and status near the top
                of the app. Tap a slot below to cycle it through None, Direct Messages, and Settings; the first
                slot renders on the left. Fork of Purple-EyeZ's YouBar+, ported to Revenge's Vendetta-compat API
                with a fix for a startup race that could silently skip the button patch for an entire session.
            </NoteBox>
            <FormSection title="Buttons">
                <SlotRow label="First button" slotKey="slot1" />
                <SlotRow label="Second button" slotKey="slot2" />
            </FormSection>
        </SettingsScaffold>
    );
}
