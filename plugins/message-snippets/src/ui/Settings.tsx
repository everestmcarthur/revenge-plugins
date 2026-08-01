import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import { getSnippets, saveSnippet, deleteSnippet } from "../lib/snippets";

const { ScrollView, View, TouchableOpacity } = ReactNative;
const { FormSection, FormRow, FormInput, FormText } = Forms;

function NewSnippetForm() {
    const [name, setName] = React.useState("");
    const [text, setText] = React.useState("");
    const canSave = !!name.trim() && !!text.trim();

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <FormInput title="Name" placeholder="e.g. rules" value={name} onChange={setName} />
            <FormInput title="Text" placeholder="What /snippet should send" value={text} onChange={setText} multiline />
            <TouchableOpacity
                disabled={!canSave}
                onPress={() => {
                    saveSnippet(name.trim(), text);
                    setName("");
                    setText("");
                }}
                style={{
                    marginTop: 8,
                    backgroundColor: "#5865F2",
                    borderRadius: 8,
                    padding: 10,
                    alignItems: "center",
                    opacity: canSave ? 1 : 0.5
                }}
            >
                <FormText style={{ color: "white" }}>Save snippet</FormText>
            </TouchableOpacity>
        </View>
    );
}

export default function Settings() {
    useProxy(storage);
    const snippets = getSnippets();
    useProxy(snippets);
    const names = Object.keys(snippets);

    return (
        <ScrollView style={{ flex: 1 }}>
            <FormSection title="Add a snippet">
                <NewSnippetForm />
            </FormSection>
            <FormSection title="Saved snippets">
                {names.length === 0 && (
                    <FormText style={{ marginHorizontal: 16, marginVertical: 8 }}>
                        None yet. Add one above, then send it anywhere with /snippet name.
                    </FormText>
                )}
                {names.map((name) => (
                    <FormRow
                        key={name}
                        label={name}
                        subLabel={`${snippets[name].slice(0, 60)}${snippets[name].length > 60 ? "…" : ""}  •  Tap to delete`}
                        onPress={() => deleteSnippet(name)}
                    />
                ))}
            </FormSection>
        </ScrollView>
    );
}
