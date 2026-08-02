import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ListSection from "@shared/ui/ListSection";
import ColorInput from "@shared/ui/ColorInput";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { allTags, setUserTag, removeUserTag } from "../lib/tags";

const { View } = ReactNative;
const { FormSection, FormInput } = Forms;

function AddTagForm() {
    const [userId, setUserId] = React.useState("");
    const [text, setText] = React.useState("");
    const [color, setColor] = React.useState("#5865F2");
    const canSave = !!userId.trim() && !!text.trim();

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <FormInput
                title="User ID"
                placeholder="long-press a user in Discord's own menu and Copy ID"
                value={userId}
                onChange={setUserId}
            />
            <FormInput title="Tag text" placeholder="e.g. FRIEND" value={text} onChange={setText} />
            <ColorInput title="Color" value={color} onChange={setColor} />
            <PrimaryButton
                label="Save tag"
                disabled={!canSave}
                style={{ marginTop: 8 }}
                onPress={() => {
                    setUserTag(userId.trim(), { text: text.trim(), color });
                    showToast(`Tagged user ${userId.trim()}`, undefined);
                    setUserId("");
                    setText("");
                }}
            />
        </View>
    );
}

export default function Settings() {
    useProxy(storage);
    const tags = allTags();
    useProxy(tags);
    const userIds = Object.keys(tags);

    return (
        <SettingsScaffold>
            <NoteBox>
                Long-press a name in the member list or profile popout to tag someone directly, or add
                one here by user ID - turn on Developer Mode (Discord Settings → Advanced) to get a
                "Copy ID" option when you long-press a user elsewhere.
            </NoteBox>
            <FormSection title="Add a tag">
                <AddTagForm />
            </FormSection>
            <ListSection
                title="Tagged users"
                emptyText="No one's tagged yet."
                items={userIds.map((id) => ({
                    key: id,
                    label: tags[id].text,
                    subLabel: `${id}  •  Tap to remove`,
                    onPress: () => {
                        removeUserTag(id);
                        showToast("Removed tag", undefined);
                    }
                }))}
            />
        </SettingsScaffold>
    );
}
