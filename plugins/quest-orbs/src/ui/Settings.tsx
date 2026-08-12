import { React, ReactNative } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { TableRowGroup } from "@shared/ui/table";
import { resolveSemanticColorSafe } from "@shared/lib/color";

import { completeAllVideoQuests, QuestRunResult } from "../lib/questCompleter";

const { View, Text } = ReactNative;

const textColor = () => resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");
const warningColor = () => resolveSemanticColorSafe(["TEXT_DANGER", "TEXT_NORMAL"], "#f0b232");

// Deliberately the first thing on this screen, not folded into the NoteBox below it - this is a
// real ban risk, not fine print.
function BanWarning() {
    return (
        <View
            style={{
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 4,
                padding: 12,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: warningColor(),
                backgroundColor: "rgba(240,178,50,0.08)"
            }}
        >
            <Text style={{ fontSize: 13, fontWeight: "700", color: warningColor(), marginBottom: 4 }}>
                WARNING: THIS CAN GET YOUR ACCOUNT BANNED
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: textColor() }}>
                Automating Quest completion is a form of client modification, which Discord's Terms
                of Service prohibit. Discord can and does detect and act on this kind of automation -
                using this plugin risks suspension or a permanent ban on the account it runs on.
                Nothing here disguises the traffic as anything other than what it is; it just skips
                the tedium of manually sitting through each video.{"\n\n"}
                This plugin never solves or bypasses a captcha. When claiming a reward triggers
                Discord's own captcha challenge, this plugin stops immediately and leaves that quest
                for you - you open it in Discord's normal Quests screen and complete the captcha
                yourself, exactly as if this plugin weren't involved at all.{"\n\n"}
                Use only on an account you're willing to risk, and understand this is unsupported,
                unofficial automation with no guarantee Discord won't act on it.
            </Text>
        </View>
    );
}

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
            <BanWarning />
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
                quests, paced in real time (no sped-up/faked progress) - see the warning above for
                what "automatically" does and doesn't cover.
            </NoteBox>
        </SettingsScaffold>
    );
}
