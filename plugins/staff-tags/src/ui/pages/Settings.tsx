import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ColorInput from "@shared/ui/ColorInput";
import { TAG_DEFINITIONS, tagSettings } from "../../lib/getTag";

const { FormSection, FormSwitchRow, FormInput } = Forms;

function TagSettingsSection({ id, defaultText, defaultColor }: { id: string; defaultText: string; defaultColor: string }) {
    const settings = tagSettings(id);
    useProxy(settings);

    const enabled = settings.enabled !== false;

    return (
        <FormSection title={defaultText}>
            <FormSwitchRow
                label="Show this tag"
                value={enabled}
                onValueChange={(v: boolean) => { settings.enabled = v; }}
            />
            <FormInput
                title="Tag text"
                placeholder={defaultText}
                value={settings.text ?? ""}
                editable={enabled}
                onChange={(v: string) => { settings.text = v; }}
            />
            <FormSwitchRow
                label="Custom color"
                subLabel={`Default: ${defaultColor}`}
                value={!!settings.useCustomColor}
                disabled={!enabled}
                onValueChange={(v: boolean) => { settings.useCustomColor = v; }}
            />
            {settings.useCustomColor && (
                <ColorInput
                    title="Color"
                    value={settings.color}
                    placeholder={defaultColor}
                    onChange={(v: string) => { settings.color = v; }}
                />
            )}
            <FormSwitchRow
                label="Gradient"
                subLabel="Member list & profile only, chat tags stay solid"
                value={!!settings.useGradient}
                disabled={!enabled}
                onValueChange={(v: boolean) => { settings.useGradient = v; }}
            />
            {settings.useGradient && (
                <ColorInput
                    title="Gradient color"
                    value={settings.gradientColor}
                    onChange={(v: string) => { settings.gradientColor = v; }}
                />
            )}
        </FormSection>
    );
}

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <FormSection title="General">
                <FormSwitchRow
                    label="Use top role color"
                    subLabel="Used when a tag has no custom color set"
                    value={!!storage.useRoleColor}
                    onValueChange={(v: boolean) => { storage.useRoleColor = v; }}
                />
            </FormSection>
            {TAG_DEFINITIONS.map((def) => (
                <TagSettingsSection key={def.id} id={def.id} defaultText={def.defaultText} defaultColor={def.defaultColor} />
            ))}
        </SettingsScaffold>
    );
}
