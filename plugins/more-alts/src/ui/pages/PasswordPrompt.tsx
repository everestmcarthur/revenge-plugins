import { React, NavigationNative } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { TableRowGroup, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { getSettings } from "../../lib/accounts";
import { simpleHash } from "../../lib/passwordUtils";
import { addLog } from "../../lib/logger";

interface PasswordPromptProps {
    title: string;
    message: string;
    onSuccess: () => void;
}

export default function PasswordPrompt({ title, message, onSuccess }: PasswordPromptProps) {
    const navigation = NavigationNative.useNavigation();
    const [input, setInput] = React.useState("");

    const confirm = () => {
        if (!input.trim()) {
            showToast("Please enter the password", undefined);
            return;
        }

        if (simpleHash(input) === getSettings().exportPasswordHash) {
            addLog("info", "Password verification successful");
            navigation.goBack();
            onSuccess();
        } else {
            addLog("warn", "Incorrect password attempt");
            showToast("Incorrect password", undefined);
        }
    };

    return (
        <SettingsScaffold>
            <TableRowGroup title={title}>
                <TextInput
                    label={message}
                    placeholder="Password"
                    value={input}
                    onChange={setInput}
                    secureTextEntry
                />
            </TableRowGroup>
            <PrimaryButton label="Confirm" onPress={confirm} style={{ marginHorizontal: 16, marginTop: 8 }} />
        </SettingsScaffold>
    );
}
