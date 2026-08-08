import { React, ReactNative } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { TableRowGroup } from "@shared/ui/table";
import { resolveSemanticColorSafe } from "@shared/lib/color";

import { completeAllVideoQuests, QuestRunResult } from "../lib/questCompleter";

const { View, Text } = ReactNative;

const textColor = () => resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

function summarize(result: QuestRunResult): string {
    const parts: string[] = [];
    if (result.completed.length) parts.push(`${result.completed.length} completed: ${result.completed.join(", ")}`);
    if (result.needsManualClaim.length) parts.push(`${result.needsManualClaim.length} need manual claim (captcha): ${result.needsManualClaim.join(", ")}`);
    if (result.failed.length) parts.push(`${result.failed.length} failed: ${result.failed.join(", ")}`);
    parts.push(`${result.skipped} already claimed`);
    return parts.join("\n");
}

export default function Settings() {
    const [running, setRunning] = React.useState(false);
    const [lastResult, setLastResult] = React.useState<string | null>(null);

    const run = async () => {
        if (running) return;
        setRunning(true);
        setLastResult(null);
        try {
            const result = await completeAllVideoQuests();
            setLastResult(summarize(result));
        } catch (e) {
            setLastResult(`Run failed: ${e}`);
        } finally {
            setRunning(false);
        }
    };

    return (
        <SettingsScaffold>
            <TableRowGroup title="Quest Orbs">
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <PrimaryButton
                        label={running ? "Running..." : "Complete quests now"}
                        disabled={running}
                        onPress={run}
                    />
                    {lastResult != null && (
                        <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85, color: textColor() }} selectable>
                            {lastResult}
                        </Text>
                    )}
                </View>
            </TableRowGroup>
            <NoteBox>
                Also runs automatically once when Discord loads. Only handles mobile video-watch
                quests, paced in real time (no sped-up/faked progress). If claiming a reward hits a
                captcha challenge, that quest is left for you to claim manually in Discord's normal
                Quests screen - this never tries to solve or bypass a captcha.
            </NoteBox>
        </SettingsScaffold>
    );
}
