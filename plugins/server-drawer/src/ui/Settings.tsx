import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { restart } from "../index";

const { FormSection, FormSwitchRow } = Forms;

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <NoteBox>
                Server Drawer takes over the Quest Dock (the strip above the tab bar) to show your
                servers as a grid instead - tap to expand, long-press a server for its usual context
                menu, and use the + button to create or join a server through Discord's own modal.
            </NoteBox>
            <FormSection title="Layout">
                <FormSwitchRow
                    label="Hide the left server rail"
                    subLabel="Replaces it with a single DMs icon since your servers now live in the drawer"
                    value={storage.hideGuildsBar !== false}
                    onValueChange={(v: boolean) => {
                        storage.hideGuildsBar = v;
                        restart();
                    }}
                />
                <FormSwitchRow
                    label="Unread badges"
                    subLabel="Show mention counts and unread dots on server icons in the drawer"
                    value={storage.showUnreadBadges !== false}
                    onValueChange={(v: boolean) => { storage.showUnreadBadges = v; }}
                />
            </FormSection>
        </SettingsScaffold>
    );
}
