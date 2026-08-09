import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { TableRow, TableRowGroup, TableRowArrow } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { THEMES } from "../lib/themes";

const { Text } = ReactNative;

export default function Settings() {
    useProxy(storage);

    const applyTheme = async (theme: typeof THEMES[number]) => {
        const bunny = (window as any).bunny;

        if (!bunny?.themes?.installTheme) {
            clipboard.setString(theme.url);
            showToast("Theme URL copied — paste it into Settings > Revenge > Themes");
            return;
        }

        try {
            await bunny.themes.installTheme(theme.url);
            const installed = bunny.themes.themes?.[theme.url];
            if (installed && bunny.themes.selectTheme) {
                bunny.themes.selectTheme(installed);
            }
            storage.current = theme.id;
            showToast(`Switched to ${theme.name}`);
        } catch (e: any) {
            showToast(`Failed to apply theme: ${e?.message ?? e}`);
        }
    };

    const reset = () => {
        const bunny = (window as any).bunny;

        if (!bunny?.themes?.selectTheme) {
            showToast("Revenge theme engine not available");
            return;
        }

        bunny.themes.selectTheme(null);
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
