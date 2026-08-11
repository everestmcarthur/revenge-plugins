import { React, ReactNative } from "@vendetta/metro/common";
import { plugins as installedPlugins, installPlugin, removePlugin } from "@vendetta/plugins";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { TableRow, TableRowGroup } from "@shared/ui/table";
import { fetchNexusPlugins, NexusPlugin } from "../lib/nexusApi";

const { Text, View, TouchableOpacity } = ReactNative;

interface BrowserState {
    loading: boolean;
    error: string | null;
    plugins: NexusPlugin[];
}

// Confirmed live: installing from the detail sheet could get stuck on "Installing..." forever -
// the promise from installPlugin wasn't reliably settling. This timeout is a safety net so a hung
// call can't leave a row stuck indefinitely, on top of moving the action to an inline button.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out")), ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
        );
    });
}

export default function PluginsBrowser() {
    const [state, setState] = React.useState<BrowserState>({ loading: true, error: null, plugins: [] });
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const load = React.useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: null }));
        fetchNexusPlugins()
            .then((plugins) => setState({ loading: false, error: null, plugins }))
            .catch((e) => setState({ loading: false, error: String(e?.message ?? e), plugins: [] }));
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    const onInstall = React.useCallback((plugin: NexusPlugin) => {
        setBusyId(plugin.id);
        withTimeout(installPlugin(plugin.installUrl), 20000)
            .then(() => showToast(`${plugin.name} installed`))
            .catch((e: any) => showToast(`Install failed: ${e?.message ?? e}`))
            .finally(() => setBusyId(null));
    }, []);

    const onUninstall = React.useCallback((plugin: NexusPlugin) => {
        setBusyId(plugin.id);
        try {
            removePlugin(plugin.installUrl);
            showToast(`${plugin.name} removed`);
        } catch (e: any) {
            showToast(`Remove failed: ${e?.message ?? e}`);
        } finally {
            setBusyId(null);
        }
    }, []);

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
                        const busy = busyId === plugin.id;
                        return (
                            <TableRow
                                key={plugin.id}
                                label={plugin.name}
                                subLabel={installed ? "Installed - tap to remove" : plugin.tagline || plugin.description}
                                trailing={
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        {plugin.status && plugin.status !== "default" && (
                                            <Text style={{ fontSize: 11, fontWeight: "700", opacity: 0.7, marginRight: 8 }}>
                                                {plugin.status.toUpperCase()}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            disabled={busy}
                                            onPress={() => (installed ? onUninstall(plugin) : onInstall(plugin))}
                                            style={{
                                                backgroundColor: installed ? "rgba(35,165,90,0.2)" : "#5865F2",
                                                borderRadius: 6,
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                opacity: busy ? 0.6 : 1,
                                            }}
                                        >
                                            <Text style={{ color: installed ? "#23A55A" : "white", fontSize: 12, fontWeight: "600" }}>
                                                {busy
                                                    ? installed ? "Removing…" : "Installing…"
                                                    : installed ? "✓ Installed" : "Install"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                }
                            />
                        );
                    })}
                </TableRowGroup>
            ))}
        </SettingsScaffold>
    );
}
