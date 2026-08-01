import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { clipboard } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { getLastDetection } from "../lib/diagnostics";

const { FormSection, FormRow } = Forms;

const STRATEGY_LABEL: Record<string, string> = {
    buttons: "Strategy 1 (button list) - working normally",
    actionSheetRow: "Strategy 2 (row group) - working normally",
    generic: "Strategy 3 (generic fallback) - the primary two shapes didn't match on this Discord build, but a broader fallback found a spot anyway",
    none: "None matched - the button couldn't be added on this Discord build"
};

export default function Settings() {
    const detection = getLastDetection();

    return (
        <SettingsScaffold>
            <FormSection title="Diagnostics">
                {detection ? (
                    <FormRow
                        label={STRATEGY_LABEL[detection.strategy] ?? detection.strategy}
                        subLabel={`Last checked ${new Date(detection.timestamp).toLocaleString()}${detection.detail ? ` - ${detection.detail}` : ""}`}
                    />
                ) : (
                    <NoteBox>
                        No data yet - long-press any message once, then come back here.
                    </NoteBox>
                )}
                <PrimaryButton
                    style={{ marginHorizontal: 16, marginTop: 8 }}
                    label="Copy diagnostics"
                    disabled={!detection}
                    onPress={() => {
                        clipboard.setString(JSON.stringify(detection, null, 2));
                        showToast("Copied - paste this if you're reporting an issue", undefined);
                    }}
                />
            </FormSection>
            <NoteBox>
                "View Raw" is added to the message long-press menu by detecting Discord's internal
                action-sheet layout, which isn't an official API and can change between app versions.
                If it stops appearing for you, open this page after long-pressing a message and copy
                the diagnostics into a bug report - it'll say exactly which detection strategy ran.
            </NoteBox>
        </SettingsScaffold>
    );
}
