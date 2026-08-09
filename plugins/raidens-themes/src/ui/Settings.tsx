import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { themes } from "@vendetta";
import { TableRow, TableRowGroup, TableRowArrow } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { THEMES } from "../lib/themes";

const { Text } = ReactNative;

// Used to check window.bunny.themes - this client only has vendetta, so every tap silently fell
// back to the clipboard-copy path. vendetta.themes has the same shape, ported directly.
export default function Settings() {
    useProxy(storage);

    const applyTheme = async (theme: typeof THEMES[number]) => {
        if (!themes?.installTheme) {
            clipboard.setString(theme.url);
            showToast("Theme URL copied — paste it into Settings > Revenge > Themes");
            return;
        }

        try {
            await themes.installTheme(theme.url);
            // vendetta-types says selectTheme takes an id string, but that resolves without
            // applying anything - it actually wants the installed theme object.
            const installed = themes.themes?.[theme.url];
            if (installed && themes.selectTheme) {
                await themes.selectTheme(installed as any);
            }
            storage.current = theme.id;
            showToast(`Switched to ${theme.name}`);
        } catch (e: any) {
            showToast(`Failed to apply theme: ${e?.message ?? e}`);
        }
    };

    const reset = () => {
        if (!themes?.selectTheme) {
            showToast("Revenge theme engine not available");
            return;
        }

        themes.selectTheme(null);
        storage.current = "";
        showToast("Default theme restored");
    };

    return (
        <SettingsScaffold>
            <NoteBox>
                Tap a theme to install and apply it instantly. If the one-tap theme engine isn't available,
                the theme URL is copied to your clipboard instead.
            </NoteBox>
            <TableRowGroup title="Default">
                <TableRow
                    label="Reset to default"
                    onPress={reset}
                />
            </TableRowGroup>
            <TableRowGroup title="Raiden's Themes">
                {THEMES.map((theme) => (
                    <TableRow
                        key={theme.id}
                        label={theme.name}
                        subLabel={theme.id}
                        onPress={() => applyTheme(theme)}
                        trailing={
                            storage.current === theme.id
                                ? <Text style={{ fontSize: 16 }}>✓</Text>
                                : <TableRowArrow />
                        }
                    />
                ))}
            </TableRowGroup>
        </SettingsScaffold>
    );
}
