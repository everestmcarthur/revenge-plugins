import { React, ReactNative } from "@vendetta/metro/common";
import { plugins as installedPlugins, installPlugin } from "@vendetta/plugins";
import { showToast } from "@vendetta/ui/toasts";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { NexusPlugin } from "../lib/nexusApi";

const { ScrollView, Text } = ReactNative;

export default function PluginDetailSheet({ plugin }: { plugin: NexusPlugin }) {
    const [installing, setInstalling] = React.useState(false);
    const alreadyInstalled = plugin.installUrl in installedPlugins;

    const onInstall = React.useCallback(() => {
        setInstalling(true);
        installPlugin(plugin.installUrl)
            .then(() => {
                setInstalling(false);
                showToast(`${plugin.name} installed`);
            })
            .catch((e: any) => {
                setInstalling(false);
                showToast(`Install failed: ${e?.message ?? e}`);
            });
    }, [plugin.installUrl]);

    return (
        <ScrollView style={{ maxHeight: 400, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{plugin.name}</Text>
            <Text style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{plugin.category}</Text>
            <Text style={{ fontSize: 14, marginBottom: 16 }}>{plugin.tagline || plugin.description}</Text>
            {plugin.status && plugin.status !== "default" && (
                <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 16 }}>
                    {plugin.status.toUpperCase()}
                </Text>
            )}
            <PrimaryButton
                label={alreadyInstalled ? "Installed" : installing ? "Installing…" : "Install"}
                disabled={alreadyInstalled || installing}
                onPress={onInstall}
            />
        </ScrollView>
    );
}
