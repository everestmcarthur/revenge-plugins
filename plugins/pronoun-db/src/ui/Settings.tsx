import { ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { ScrollView, View, TouchableOpacity, Linking } = ReactNative;
const { FormSection, FormText } = Forms;

const PRONOUNDB_URL = "https://pronoundb.org/";

export default function Settings() {
    return (
        <ScrollView style={{ flex: 1 }}>
            <FormSection title="How this works">
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <FormText style={{ marginBottom: 12 }}>
                        This plugin doesn't have anything to configure here - there's no API key or toggle,
                        because pronouns aren't Discord data. They come from PronounDB, a separate service
                        where people manually set their own pronouns and link the profile to their Discord
                        account.
                    </FormText>
                    <FormText style={{ marginBottom: 12 }}>
                        That means a user's pronouns will only show up if THEY set them at pronoundb.org - not
                        because of anything you enable here. If you want your own pronouns to show up for
                        other people running this plugin, set them yourself at the link below.
                    </FormText>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(PRONOUNDB_URL)}
                        style={{
                            backgroundColor: "#5865F2",
                            borderRadius: 8,
                            padding: 12,
                            alignItems: "center"
                        }}
                    >
                        <FormText style={{ color: "white" }}>Open pronoundb.org</FormText>
                    </TouchableOpacity>
                </View>
            </FormSection>
        </ScrollView>
    );
}
