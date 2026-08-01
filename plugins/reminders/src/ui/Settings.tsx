import { React } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ListSection from "@shared/ui/ListSection";
import NoteBox from "@shared/ui/NoteBox";
import { getReminders, removeReminder } from "../lib/reminders";

function formatRemaining(dueAt: number): string {
    const ms = dueAt - Date.now();
    if (ms <= 0) return "due now";

    const mins = Math.round(ms / 60000);
    if (mins < 60) return `in ${mins}m`;

    const hours = Math.round(mins / 60);
    if (hours < 24) return `in ${hours}h`;

    return `in ${Math.round(hours / 24)}d`;
}

export default function Settings() {
    useProxy(storage);
    const reminders = getReminders();
    useProxy(reminders);

    return (
        <SettingsScaffold>
            <ListSection
                title="Pending reminders"
                emptyText='None yet. Set one from any chat with /remind, e.g. "/remind 20m Walk the dog".'
                items={reminders.map((r) => ({
                    key: r.id,
                    label: r.text,
                    subLabel: `${formatRemaining(r.dueAt)}  •  Tap to cancel`,
                    onPress: () => removeReminder(r.id)
                }))}
            />
            <NoteBox>
                Reminders fire while Discord is open (foreground or background) - they can't wake the app
                up from fully closed, since that needs a native OS-level notification this plugin doesn't
                have access to.
            </NoteBox>
        </SettingsScaffold>
    );
}
