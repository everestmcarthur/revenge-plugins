import { React, ReactNative } from "@vendetta/metro/common";
import { TableRowGroup } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";

const { View, Linking } = ReactNative;

const PRONOUNDB_URL = "https://pronoundb.org/";

export default function Settings() {
    return (
        <SettingsScaffold>
            <TableRowGroup title="How this works">
                <NoteBox>
                    This plugin doesn't have anything to configure here - there's no API key or toggle,
                    because pronouns aren't Discord data. They come from PronounDB, a separate service
                    where people manually set their own pronouns and link the profile to their Discord
                    account.
                </NoteBox>
                <NoteBox>
                    That means a user's pronouns will only show up if THEY set them at pronoundb.org - not
                    because of anything you enable here. If you want your own pronouns to show up for
                    other people running this plugin, set them yourself at the link below.
                </NoteBox>
                <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
                    <PrimaryButton label="Open pronoundb.org" onPress={() => Linking.openURL(PRONOUNDB_URL)} />
                </View>
            </TableRowGroup>
        </SettingsScaffold>
    );
}
