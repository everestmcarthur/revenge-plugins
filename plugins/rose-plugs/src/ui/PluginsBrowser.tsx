import { React, ReactNative } from "@vendetta/metro/common";
import { plugins as installedPlugins } from "@vendetta/plugins";
import { showCustomAlert } from "@vendetta/ui/alerts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { TableRow, TableRowGroup } from "@shared/ui/table";
import { fetchNexusPlugins, NexusPlugin } from "../lib/nexusApi";
import PluginDetailSheet from "./PluginDetailSheet";

const { Text } = ReactNative;

interface BrowserState {
    loading: boolean;
    error: string | null;
    plugins: NexusPlugin[];
}

export default function PluginsBrowser() {
    const [state, setState] = React.useState<BrowserState>({ loading: true, error: null, plugins: [] });

    const load = React.useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: null }));
        fetchNexusPlugins()
            .then((plugins) => setState({ loading: false, error: null, plugins }))
            .catch((e) => setState({ loading: false, error: String(e?.message ?? e), plugins: [] }));
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    if (state.loading) {
        return (
            <SettingsScaffold>
                <NoteBox>Loading Rosie's plugins…</NoteBox>
            </SettingsScaffold>
        );
    }

    if (state.error) {
        return (
            <SettingsScaffold>
                <NoteBox>Couldn't load the plugin list: {state.error}</NoteBox>
                <PrimaryButton label="Retry" onPress={load} style={{ margin: 16 }} />
            </SettingsScaffold>
        );
    }

    const byCategory = new Map<string, NexusPlugin[]>();
    for (const plugin of state.plugins) {
        const list = byCategory.get(plugin.category) ?? [];
        list.push(plugin);
        byCategory.set(plugin.category, list);
    }

    return (
        <SettingsScaffold>
            {[...byCategory.entries()].map(([category, plugins]) => (
                <TableRowGroup key={category} title={category}>
                    {plugins.map((plugin) => {
                        const installed = plugin.installUrl in installedPlugins;
                        return (
                            <TableRow
                                key={plugin.id}
                                label={plugin.name}
                                subLabel={installed ? "Installed" : plugin.tagline || plugin.description}
                                trailing={
                                    plugin.status && plugin.status !== "default" ? (
                                        <Text style={{ fontSize: 11, fontWeight: "700", opacity: 0.7 }}>
                                            {plugin.status.toUpperCase()}
                                        </Text>
                                    ) : installed ? (
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#23A55A" }}>✓</Text>
                                    ) : undefined
                                }
                                onPress={() => showCustomAlert(PluginDetailSheet, { plugin })}
                            />
                        );
                    })}
                </TableRowGroup>
            ))}
        </SettingsScaffold>
    );
}
