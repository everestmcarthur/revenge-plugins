import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ListSection from "@shared/ui/ListSection";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { getSnippets, saveSnippet, deleteSnippet } from "../lib/snippets";

const { View } = ReactNative;
const { FormSection, FormInput } = Forms;

function NewSnippetForm() {
    const [name, setName] = React.useState("");
    const [text, setText] = React.useState("");
    const canSave = !!name.trim() && !!text.trim();

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <FormInput title="Name" placeholder="e.g. rules" value={name} onChange={setName} />
            <FormInput title="Text" placeholder="What /snippet should send" value={text} onChange={setText} multiline />
            <PrimaryButton
                label="Save snippet"
                disabled={!canSave}
                style={{ marginTop: 8 }}
                onPress={() => {
                    saveSnippet(name.trim(), text);
                    showToast(`Saved snippet "${name.trim()}"`, undefined);
                    setName("");
                    setText("");
                }}
            />
        </View>
    );
}

export default function Settings() {
    useProxy(storage);
    const snippets = getSnippets();
    useProxy(snippets);
    const names = Object.keys(snippets);

    return (
        <SettingsScaffold>
            <FormSection title="Add a snippet">
                <NewSnippetForm />
            </FormSection>
            <ListSection
                title="Saved snippets"
                emptyText="None yet. Add one above, then send it anywhere with /snippet name."
                items={names.map((name) => ({
                    key: name,
                    label: name,
                    subLabel: `${snippets[name].slice(0, 60)}${snippets[name].length > 60 ? "…" : ""}  •  Tap to delete`,
                    onPress: () => {
                        deleteSnippet(name);
                        showToast(`Deleted snippet "${name}"`, undefined);
                    }
                }))}
            />
        </SettingsScaffold>
    );
}
