import { React } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { TableRowGroup, TextInput, TableSwitchRow } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ColorInput from "@shared/ui/ColorInput";
import NoteBox from "@shared/ui/NoteBox";

// The ring patch itself does a generic colors[status] lookup, not one hardcoded to three statuses -
// offline just needed its own configurable entry here to work the same way the other three already
// do. Discord doesn't show a colored dot for offline at all normally, so this is opt-in (blank by
// default) rather than given a default color like the other three.
const STATUSES: { key: string; label: string; defaultColor?: string }[] = [
    { key: "online", label: "Online", defaultColor: "#23A55A" },
    { key: "idle", label: "Idle", defaultColor: "#F0B232" },
    { key: "dnd", label: "Do Not Disturb", defaultColor: "#F23F42" },
    { key: "offline", label: "Offline", defaultColor: "#80848E" }
];

function numberInput(title: string, key: "ringThickness", placeholder: string) {
    return (
        <TextInput
            label={title}
            placeholder={placeholder}
            value={String(storage[key] ?? placeholder)}
            onChange={(v: string) => {
                const n = parseFloat(v);
                if (!Number.isNaN(n) && n > 0) storage[key] = n;
            }}
            keyboardType="numeric"
        />
    );
}


export default function Settings() {
    useProxy(storage);
    storage.colors ??= {};

    return (
        <SettingsScaffold>
            <NoteBox>
                Replaces the small presence dot on an avatar with a colored ring instead, per status
                below. Leave a status blank to keep showing the normal dot for it. Confirmed on-device
                across YouBar, the profile screen, member lists, and DM lists - matches the specific
                avatar sizes seen in each of those contexts, so other unrelated circular UI elements are
                left alone.
            </NoteBox>
            <TableRowGroup title="Enable">
                <TableSwitchRow
                    label="Draw ring around avatars"
                    value={!!storage.enabled}
                    onValueChange={(v: boolean) => { storage.enabled = v; }}
                />
            </TableRowGroup>
            <TableRowGroup title="Ring colors">
                {STATUSES.map(({ key, label, defaultColor }) => (
                    <ColorInput
                        key={key}
                        title={label}
                        value={storage.colors[key]}
                        placeholder={defaultColor}
                        onChange={(v: string) => {
                            storage.colors = { ...storage.colors, [key]: v };
                        }}
                    />
                ))}
            </TableRowGroup>
            <TableRowGroup title="Ring size">
                {numberInput("Ring thickness", "ringThickness", "2")}
            </TableRowGroup>
        </SettingsScaffold>
    );
}
