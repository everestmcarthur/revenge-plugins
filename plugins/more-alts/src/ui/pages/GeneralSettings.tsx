import { React, NavigationNative, ReactNative, clipboard } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { getSettings } from "../../lib/accounts";
import {
    RequirePassword,
    addAccountWithToken,
    exportAccounts,
    forceLogout,
    importAccounts,
    removeExportPassword,
    setExportPassword
} from "../../lib/accountActions";
import { addLog, clearLogs, getLogs } from "../../lib/logger";
import PasswordPrompt from "./PasswordPrompt";

const { View } = ReactNative;

export default function GeneralSettings() {
    const settings = getSettings();
    useProxy(settings);
    const navigation = NavigationNative.useNavigation();
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    const [importText, setImportText] = React.useState("");
    const [newToken, setNewToken] = React.useState("");
    const [isAddingToken, setIsAddingToken] = React.useState(false);
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");

    const requirePassword: RequirePassword = ({ title, message, onSuccess }) => {
        navigation.navigate("VendettaCustomPage", {
            title,
            render: () => <PasswordPrompt title={title} message={message} onSuccess={onSuccess} />
        });
    };

    const copyLogs = () => {
        const logs = getLogs();
        const text = logs
            .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}${l.data ? " | Data: " + JSON.stringify(l.data) : ""}`)
            .join("\n");
        clipboard.setString(text);
        addLog("info", "Logs copied to clipboard", { count: logs.length });
        showToast(`Copied ${logs.length} log entries to clipboard`, undefined);
        forceUpdate();
    };

    const addToken = async () => {
        setIsAddingToken(true);
        const ok = await addAccountWithToken(newToken);
        setIsAddingToken(false);
        if (ok) setNewToken("");
        forceUpdate();
    };

    return (
        <SettingsScaffold>
            <TableRowGroup title="General">
                <TableSwitchRow
                    label="Enable native multi-account switcher"
                    subLabel="Unlocks Discord's own built-in account switcher (restart app to apply)"
                    value={!!settings.enableNativeSwitcher}
                    onValueChange={(v: boolean) => { settings.enableNativeSwitcher = v; forceUpdate(); showToast("Restart app to apply", undefined); }}
                />
                <TableSwitchRow
                    label="Show discriminator"
                    subLabel="Shows username#0000 instead of the display name in the account list"
                    value={!!settings.enableCLI}
                    onValueChange={(v: boolean) => { settings.enableCLI = v; forceUpdate(); }}
                />
                <TableSwitchRow
                    label="Add to settings sidebar"
                    subLabel="Restart app to apply"
                    value={!!settings.addToSidebar}
                    onValueChange={(v: boolean) => { settings.addToSidebar = v; forceUpdate(); showToast("Restart app to apply", undefined); }}
                />
                <TableSwitchRow
                    label="Confirm before delete"
                    value={!!settings.confirmBeforeDelete}
                    onValueChange={(v: boolean) => { settings.confirmBeforeDelete = v; forceUpdate(); }}
                />
            </TableRowGroup>

            <TableRowGroup title="Backup & restore">
                <PrimaryButton
                    label="Export accounts to clipboard"
                    onPress={() => exportAccounts(requirePassword)}
                    style={{ marginHorizontal: 16, marginTop: 8 }}
                />
                <TextInput
                    label="Import data (leave empty to use clipboard)"
                    value={importText}
                    onChange={setImportText}
                    multiline
                />
                <PrimaryButton
                    label="Import accounts"
                    onPress={() => importAccounts(requirePassword, importText, forceUpdate)}
                    style={{ marginHorizontal: 16, marginBottom: 8 }}
                />
                <PrimaryButton label="Force logout" onPress={forceLogout} style={{ marginHorizontal: 16, marginBottom: 8 }} />
            </TableRowGroup>

            <TableRowGroup title="Export password protection">
                {settings.exportPasswordHash ? (
                    <>
                        <NoteBox>Export password is set.</NoteBox>
                        <PrimaryButton
                            label="Remove password"
                            onPress={() => removeExportPassword(requirePassword, forceUpdate)}
                            style={{ marginHorizontal: 16, marginBottom: 8 }}
                        />
                    </>
                ) : (
                    <>
                        <TextInput label="New password" value={newPassword} onChange={setNewPassword} secureTextEntry />
                        <TextInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} secureTextEntry />
                        <PrimaryButton
                            label="Set password"
                            onPress={() => {
                                if (setExportPassword(newPassword, confirmPassword)) {
                                    setNewPassword("");
                                    setConfirmPassword("");
                                }
                                forceUpdate();
                            }}
                            style={{ marginHorizontal: 16, marginBottom: 8 }}
                        />
                    </>
                )}
            </TableRowGroup>

            <TableRowGroup title="Unsafe features">
                <NoteBox>Token copying, manual token adding, and detailed logging. These can compromise account security if misused - never share a token with anyone.</NoteBox>
                <TableSwitchRow
                    label="Enable unsafe features"
                    value={!!settings.enableUnsafeFeatures}
                    onValueChange={(v: boolean) => { settings.enableUnsafeFeatures = v; forceUpdate(); }}
                />
            </TableRowGroup>

            {settings.enableUnsafeFeatures && (
                <>
                    <TableRowGroup title="Add account via token">
                        <TextInput
                            label="Token (leave empty to add current account's token)"
                            value={newToken}
                            onChange={setNewToken}
                            secureTextEntry
                        />
                        <PrimaryButton
                            label={isAddingToken ? "Adding..." : "Add account"}
                            onPress={addToken}
                            disabled={isAddingToken}
                            style={{ marginHorizontal: 16, marginBottom: 8 }}
                        />
                    </TableRowGroup>

                    <TableRowGroup title="Troubleshooting">
                        <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
                            <PrimaryButton label={`Copy logs (${getLogs().length})`} onPress={copyLogs} style={{ flex: 1 }} />
                            <PrimaryButton label="Clear logs" onPress={() => { clearLogs(); forceUpdate(); }} style={{ flex: 1 }} />
                        </View>
                    </TableRowGroup>
                </>
            )}
        </SettingsScaffold>
    );
}
