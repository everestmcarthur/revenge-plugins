import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { runAllChecks, formatReport } from "../lib/checks";
import { dumpVendettaApiTree } from "../lib/apiTree";

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
