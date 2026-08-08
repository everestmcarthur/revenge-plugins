import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { TableRowGroup, TextInput } from "@shared/ui/table";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ListSection from "@shared/ui/ListSection";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { allTags, setUserTag, removeUserTag } from "../lib/tags";
import { getIcon } from "../lib/icons";
import ColorInput from "./ColorInput";
import IconPicker from "./IconPicker";

const { View } = ReactNative;

function AddTagForm() {
    const [userId, setUserId] = React.useState("");
    const [text, setText] = React.useState("");
    const [color, setColor] = React.useState("#5865F2");
    const [icon, setIcon] = React.useState("none");
    const canSave = !!userId.trim() && (!!text.trim() || icon !== "none");

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <TextInput
                label="User ID"
                placeholder="long-press a user in Discord's own menu and Copy ID"
                value={userId}
                onChange={setUserId}
            />
            <TextInput label="Tag text (optional if icon is set)" placeholder="e.g. FRIEND" value={text} onChange={setText} />
            <IconPicker title="Icon" value={icon} onChange={setIcon} color={color} />
            <ColorInput title="Color" value={color} onChange={setColor} />
            <PrimaryButton
                label="Save tag"
                disabled={!canSave}
                style={{ marginTop: 8 }}
                onPress={() => {
                    setUserTag(userId.trim(), { text: text.trim(), color, icon: icon === "none" ? undefined : icon });
                    showToast(`Tagged user ${userId.trim()}`, undefined);
                    setUserId("");
                    setText("");
                    setIcon("none");
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
            <TableRowGroup title="Add a tag">
                <AddTagForm />
            </TableRowGroup>
            <ListSection
                title="Tagged users"
                emptyText="No one's tagged yet."
                items={userIds.map((id) => {
                    const icon = getIcon(tags[id].icon)?.fallback;
                    const label = icon ? `${icon} ${tags[id].text}`.trim() : tags[id].text;
                    return {
                        key: id,
                        label,
                        subLabel: `${id}  •  Tap to remove`,
                        onPress: () => {
                            removeUserTag(id);
                            showToast("Removed tag", undefined);
                        }
                    };
                })}
            />
        </SettingsScaffold>
    );
}
