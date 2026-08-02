import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { runAllChecks, formatReport } from "../lib/checks";
import { dumpVendettaApiTree } from "../lib/apiTree";
import { runYouBarDiagnostics } from "../lib/youBarDiagnostics";
import { runEval } from "../lib/evalTool";

const { View, Text } = ReactNative;
const { FormSection, FormInput } = Forms;

function FullScanSection() {
    const [summary, setSummary] = React.useState<string | null>(null);

    return (
        <FormSection title="Full diagnostic scan">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <PrimaryButton
                    label="Run scan & copy full report"
                    onPress={() => {
                        const results = runAllChecks();
                        const missing = results.filter((r) => !r.found).length;
                        clipboard.setString(formatReport(results));
                        setSummary(`${results.length} checked, ${missing} missing - full report copied`);
                        showToast(`${missing} missing out of ${results.length} - report copied`, undefined);
                    }}
                />
                {summary && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7 }}>{summary}</Text>
                )}
            </View>
        </FormSection>
    );
}

function YouBarDiagnosticsSection() {
    return (
        <FormSection title="YouBar+ diagnostics">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <PrimaryButton
                    label="Run YouBar+ diagnostics & copy report"
                    onPress={() => {
                        const report = runYouBarDiagnostics();
                        clipboard.setString(report);
                        showToast("Diagnostics copied - paste into chat", undefined);
                    }}
                />
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7 }}>
                    Checks whether YouBarNotificationsButton can be found live, whether the React
                    DevTools fiber-root registry forceRerender depends on is actually populated, and
                    whether a class-component ancestor or the navigation ref fallback exists at all -
                    run this right after toggling YouBar+ on/off to see exactly which step is failing.
                </Text>
            </View>
        </FormSection>
    );
}

function EvalSection() {
    const [code, setCode] = React.useState("");
    const [result, setResult] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);

    const run = async () => {
        if (!code.trim() || running) return;
        setRunning(true);
        try {
            const output = await runEval(code);
            setResult(output);
            clipboard.setString(output);
            showToast("Result copied", undefined);
        } finally {
            setRunning(false);
        }
    };

    return (
        <FormSection title="Eval">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="Code"
                    placeholder={'e.g. return findByProps("getRootNavigationRef")'}
                    value={code}
                    onChange={setCode}
                    multiline
                />
                <PrimaryButton
                    label={running ? "Running..." : "Run & copy result"}
                    style={{ marginTop: 8 }}
                    disabled={running}
                    onPress={run}
                />
                {result != null && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85 }} selectable>
                        {result.length > 2000 ? `${result.slice(0, 2000)}\n... (truncated, full result copied)` : result}
                    </Text>
                )}
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7 }}>
                    Runs as the body of an async function - a bare expression, `return ...`, or
                    `await ...` all work. findByProps/findByName/find, the raw* passive variants
                    (rawFind/rawFindByTypeName/rawFindByProps/rawFindByName/rawFindByStoreName),
                    React, ReactNative, FluxDispatcher, and window are already in scope. Nothing runs
                    until you tap the button.
                </Text>
            </View>
        </FormSection>
    );
}

function ApiTreeSection() {
    return (
        <FormSection title="Full Vendetta API tree">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <PrimaryButton
                    label="Copy the entire plugin API tree"
                    onPress={() => {
                        const tree = dumpVendettaApiTree(3);
                        const lineCount = tree.split("\n").length;
                        clipboard.setString(tree);
                        showToast(`Copied ${lineCount} lines - every key path under window.vendetta`, undefined);
                    }}
                />
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7 }}>
                    Every key path under the stable plugin API (window.vendetta), 3 levels deep - this
                    is everything Revenge itself exposes to plugins, not Discord's raw internals (those
                    are searchable individually below, since dumping all of them would be enormous).
                </Text>
            </View>
        </FormSection>
    );
}

function ManualSearchSection() {
    const [propQuery, setPropQuery] = React.useState("");
    const [nameQuery, setNameQuery] = React.useState("");

    const searchProps = () => {
        const props = propQuery.split(",").map((p) => p.trim()).filter(Boolean);
        if (!props.length) return;

        try {
            const mod = findByProps(...props);
            if (!mod) {
                clipboard.setString(`findByProps(${props.join(", ")}) -> not found`);
                showToast("No module found - copied that result", undefined);
                return;
            }
            const keys = Object.keys(mod).sort();
            clipboard.setString(`findByProps(${props.join(", ")}) -> found, keys:\n${keys.join("\n")}`);
            showToast(`Found it - copied ${keys.length} key(s)`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for ${props.join(", ")}: ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    const searchName = () => {
        const name = nameQuery.trim();
        if (!name) return;

        try {
            const mod = findByName(name, false);
            if (!mod) {
                clipboard.setString(`findByName("${name}") -> not found`);
                showToast("No component found - copied that result", undefined);
                return;
            }
            const keys = Object.keys(mod).sort();
            clipboard.setString(`findByName("${name}") -> found, keys:\n${keys.join("\n")}`);
            showToast(`Found it - copied ${keys.length} key(s)`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for "${name}": ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    return (
        <FormSection title="One-off search">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="findByProps - comma-separated prop names"
                    placeholder="e.g. sendMessage, sendBotMessage"
                    value={propQuery}
                    onChange={setPropQuery}
                />
                <PrimaryButton label="Search & copy result" style={{ marginTop: 8, marginBottom: 16 }} onPress={searchProps} />

                <FormInput
                    title="findByName - component name"
                    placeholder="e.g. ThemedRolePill"
                    value={nameQuery}
                    onChange={setNameQuery}
                />
                <PrimaryButton label="Search & copy result" style={{ marginTop: 8 }} onPress={searchName} />
            </View>
        </FormSection>
    );
}

export default function Settings() {
    return (
        <SettingsScaffold>
            <FullScanSection />
            <YouBarDiagnosticsSection />
            <EvalSection />
            <ApiTreeSection />
            <ManualSearchSection />
            <NoteBox>
                The full scan checks every internal lookup this repo's plugins depend on (plus a few
                for plugins currently being fixed) in one pass, and includes the complete list of
                semanticColors/rawColors keys at the end. Paste the report back into chat when
                reporting a bug - it tells us exactly what's missing on your Discord version.
            </NoteBox>
        </SettingsScaffold>
    );
}
