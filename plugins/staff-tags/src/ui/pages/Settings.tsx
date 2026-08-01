import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import { TAG_DEFINITIONS, tagSettings } from "../../lib/getTag";

const { ScrollView, View } = ReactNative;
const { FormSection, FormSwitchRow, FormInput } = Forms;

const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function TagSettingsSection({ id, defaultText, defaultColor }: { id: string; defaultText: string; defaultColor: string }) {
    const settings = tagSettings(id);
    useProxy(settings);

    const enabled = settings.enabled !== false;
    const invalidColor = !!settings.color && !HEX_REGEX.test(settings.color);
    const invalidGradient = !!settings.gradientColor && !HEX_REGEX.test(settings.gradientColor);

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
                <FormInput
                    title="Color (hex)"
                    placeholder={defaultColor}
                    value={settings.color ?? ""}
                    editable={enabled}
                    onChange={(v: string) => { settings.color = v; }}
                    helpText={invalidColor ? "Invalid hex color, e.g. #5865F2 - falling back to default for now" : undefined}
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
                <FormInput
                    title="Gradient color (hex)"
                    placeholder="Leave blank to auto-generate"
                    value={settings.gradientColor ?? ""}
                    editable={enabled}
                    onChange={(v: string) => { settings.gradientColor = v; }}
                    helpText={invalidGradient ? "Invalid hex color, leave blank to auto-generate" : undefined}
                />
            )}
        </FormSection>
    );
}

export default function Settings() {
    useProxy(storage);

    return (
        <ScrollView style={{ flex: 1 }}>
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
            <View style={{ height: 24 }} />
        </ScrollView>
    );
}
