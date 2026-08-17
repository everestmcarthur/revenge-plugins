import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { TableRowGroup, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ListSection from "@shared/ui/ListSection";
import PrimaryButton from "@shared/ui/PrimaryButton";
import NoteBox from "@shared/ui/NoteBox";
import { allTags } from "../lib/tags";
import { getIcon } from "../lib/icons";
import openTagEditor from "./TagEditorAlert";

const { View } = ReactNative;

// Opens the same rich editor used for long-press tagging (full SVG/icon-only support) instead of
// keeping a second, simpler add-tag form here that would drift out of sync with it.
function AddTagForm() {
    const [userId, setUserId] = React.useState("");

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <TextInput
                label="User ID"
                placeholder="long-press a user in Discord's own menu and Copy ID"
                value={userId}
                onChange={setUserId}
            />
            <PrimaryButton
                label="Edit tag"
                disabled={!userId.trim()}
                style={{ marginTop: 8 }}
                onPress={() => openTagEditor(userId.trim(), userId.trim())}
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
                    const icon = getIcon(tags[id].icon)?.fallback || tags[id].customSvgFallback;
                    const label = (icon ? `${icon} ${tags[id].text}` : tags[id].text).trim() || id;
                    return {
                        key: id,
                        label,
                        subLabel: `${id}  •  Tap to edit`,
                        onPress: () => openTagEditor(id, tags[id].text || id)
                    };
                })}
            />
        </SettingsScaffold>
    );
}
