import { ReactNative, clipboard, React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Button } from "@vendetta/ui/components";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { cleanMessage } from "./cleanMessage";
import JsonView from "./JsonView";

const { View, ScrollView, TextInput, Text } = ReactNative;

export default function RawPage({ message }: { message: any }) {
    const [query, setQuery] = React.useState("");
    const stringMessage = React.useMemo(() => JSON.stringify(cleanMessage(message), null, 4), [message.id]);
    // The search box previously hardcoded white text (illegible on a light theme) and the two
    // section labels below had no color at all (illegible black-on-black on a dark theme, RN's
    // Text default with no theming of its own).
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

    return (
        <ScrollView style={{ flex: 1, marginHorizontal: 13, marginVertical: 10 }}>
            <View style={{ flexDirection: "row" }}>
                <Button
                    style={{ flex: 1, marginRight: 8, marginBottom: 8 }}
                    text="Copy Content"
                    color="brand"
                    size="small"
                    disabled={!message.content}
                    onPress={() => {
                        clipboard.setString(message.content);
                        showToast("Copied content to clipboard", getAssetIDByName("toast_copy_link"));
                    }}
                />
                <Button
                    style={{ flex: 1, marginBottom: 8 }}
                    text="Copy JSON"
                    color="brand"
                    size="small"
                    onPress={() => {
                        clipboard.setString(stringMessage);
                        showToast("Copied JSON to clipboard", getAssetIDByName("toast_copy_link"));
                    }}
                />
            </View>

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search keys or values…"
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                    borderWidth: 1,
                    borderColor: "rgba(128,128,128,0.35)",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 10,
                    color: textColor
                }}
            />

            {!!message.content && (
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, fontWeight: "700", color: textColor }}>MESSAGE CONTENT</Text>
                    <Text selectable style={{ fontFamily: "monospace", fontSize: 13, color: textColor }}>{message.content}</Text>
                </View>
            )}

            <Text style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, fontWeight: "700", color: textColor }}>RAW DATA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
                <JsonView text={stringMessage} query={query} />
            </ScrollView>
        </ScrollView>
    );
}
