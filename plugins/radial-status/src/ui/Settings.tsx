import { React } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ColorInput from "@shared/ui/ColorInput";
import NoteBox from "@shared/ui/NoteBox";

const { FormSection, FormInput, FormSwitchRow } = Forms;

const STATUSES: { key: string; label: string; defaultColor: string }[] = [
    { key: "online", label: "Online", defaultColor: "#23A55A" },
    { key: "idle", label: "Idle", defaultColor: "#F0B232" },
    { key: "dnd", label: "Do Not Disturb", defaultColor: "#F23F42" }
];

function numberInput(title: string, key: "ringMult" | "ringThickness", placeholder: string) {
    return (
        <FormInput
            title={title}
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
                below. Leave a status blank to keep showing the normal dot for it.
            </NoteBox>
            <FormSection title="Enable">
                <FormSwitchRow
                    label="Draw ring around avatars"
                    value={!!storage.enabled}
                    onValueChange={(v: boolean) => { storage.enabled = v; }}
                />
            </FormSection>
            <FormSection title="Ring colors">
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
            </FormSection>
            <FormSection title="Ring size">
                {numberInput("Size multiplier", "ringMult", "1.3")}
                {numberInput("Ring thickness", "ringThickness", "2.5")}
            </FormSection>
        </SettingsScaffold>
    );
}
