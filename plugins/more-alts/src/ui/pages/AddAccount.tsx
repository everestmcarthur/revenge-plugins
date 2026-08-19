import { React, NavigationNative, ReactNative } from "@vendetta/metro/common";
import { TableRowGroup, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { addAccountWithCredentials, addCurrentAccount } from "../../lib/accountActions";

const { View } = ReactNative;

export default function AddAccount() {
    const navigation = NavigationNative.useNavigation();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [isAdding, setIsAdding] = React.useState(false);

    const loginWithCredentials = async () => {
        setIsAdding(true);
        const ok = await addAccountWithCredentials(email, password);
        setIsAdding(false);
        if (ok) navigation.goBack();
    };

    const addCurrent = async () => {
        setIsAdding(true);
        const ok = await addCurrentAccount();
        setIsAdding(false);
        if (ok) navigation.goBack();
    };

    return (
        <SettingsScaffold>
            <NoteBox>2FA/MFA accounts aren't supported through email &amp; password login. Use "Add Current Account" instead, or add a token in General Settings.</NoteBox>
            <TableRowGroup title="Add with email & password">
                <TextInput
                    label="Email address"
                    value={email}
                    onChange={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                <TextInput
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    secureTextEntry
                />
            </TableRowGroup>
            <View style={{ marginHorizontal: 16, marginTop: 8, gap: 8 }}>
                <PrimaryButton
                    label={isAdding ? "Adding..." : "Add with Email & Password"}
                    onPress={loginWithCredentials}
                    disabled={isAdding}
                />
                <PrimaryButton
                    label={isAdding ? "Adding..." : "Add Current Account"}
                    onPress={addCurrent}
                    disabled={isAdding}
                />
            </View>
        </SettingsScaffold>
    );
}
