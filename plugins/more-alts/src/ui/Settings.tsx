import { React, NavigationNative, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { getSettings, orderedAccounts, UserStore } from "../lib/accounts";
import { copyToken, removeAccount, switchToAccount } from "../lib/accountActions";
import AddAccount from "./pages/AddAccount";
import GeneralSettings from "./pages/GeneralSettings";

const { View, Text, ScrollView, TouchableOpacity, Image } = ReactNative;

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Settings() {
    const settings = getSettings();
    useProxy(settings);
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const navigation = NavigationNative.useNavigation();

    const [switchingTo, setSwitchingTo] = React.useState<string | null>(null);

    const currentUserId = UserStore.getCurrentUser()?.id;
    const accounts = orderedAccounts();

    const handleSwitch = async (accountId: string) => {
        setSwitchingTo(accountId);
        await switchToAccount(accountId);
        setSwitchingTo(null);
        forceUpdate();
    };

    const handleRemove = (accountId: string) => {
        removeAccount(accountId, forceUpdate);
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
                <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>Saved accounts ({accounts.length})</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate("VendettaCustomPage", { title: "Settings", render: () => <GeneralSettings /> })}
                    style={{ padding: 8, borderRadius: 6, backgroundColor: "#4f545c" }}
                >
                    <Text style={{ color: "white", fontSize: 18 }}>⚙️</Text>
                </TouchableOpacity>
            </View>

            {accounts.length === 0 ? (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                    <Text style={{ color: "#72767d", fontSize: 16, marginBottom: 8 }}>No accounts saved yet</Text>
                    <Text style={{ color: "#72767d", fontSize: 14, textAlign: "center", paddingHorizontal: 24 }}>
                        Tap "Add Account" below to save this account or another one.
                    </Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
                    {accounts.map((account, index) => {
                        const isCurrent = account.id === currentUserId;
                        const isSwitching = switchingTo === account.id;
                        const avatarUrl = account.avatar
                            ? `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png?size=48`
                            : "https://cdn.discordapp.com/embed/avatars/1.png";

                        return (
                            <View
                                key={account.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    backgroundColor: isCurrent ? "#7289da20" : "#36393f",
                                    borderWidth: isCurrent ? 2 : 0,
                                    borderColor: "#7289da",
                                    borderRadius: 12,
                                    padding: 12,
                                    marginBottom: 12
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() => handleSwitch(account.id)}
                                    disabled={isCurrent || isSwitching}
                                    style={{ marginRight: 12 }}
                                >
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={{ width: 48, height: 48, borderRadius: 24, opacity: isCurrent || isSwitching ? 0.7 : 1 }}
                                    />
                                </TouchableOpacity>

                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                                        {index + 1}. {settings.enableCLI ? `${account.username}${account.discriminator !== "0" ? `#${account.discriminator}` : ""}` : account.displayName}
                                    </Text>
                                    <Text style={{ color: isCurrent ? "#43b581" : "#72767d", fontSize: 12, marginTop: 2 }}>
                                        {isCurrent ? "✓ Current account" : isSwitching ? "Switching..." : "Tap avatar to switch"}
                                    </Text>
                                    <Text style={{ color: "#72767d", fontSize: 11, marginTop: 2 }}>
                                        Added: {formatDate(account.addedAt)}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: "column", alignItems: "flex-end" }}>
                                    {!!settings.enableUnsafeFeatures && (
                                        <TouchableOpacity
                                            onPress={() => copyToken(account.id)}
                                            style={{ backgroundColor: "#4f545c", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 80, alignItems: "center", marginBottom: 6 }}
                                        >
                                            <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>Copy token</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => handleRemove(account.id)}
                                        style={{ backgroundColor: "#f04747", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 80, alignItems: "center" }}
                                    >
                                        <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <View style={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 }}>
                <TouchableOpacity
                    onPress={() => navigation.navigate("VendettaCustomPage", { title: "Add Account", render: () => <AddAccount /> })}
                    style={{ backgroundColor: "#7289da", paddingVertical: 16, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                >
                    <Text style={{ color: "white", fontSize: 20, marginRight: 8 }}>+</Text>
                    <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>Add account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
