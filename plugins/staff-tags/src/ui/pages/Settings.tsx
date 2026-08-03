import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import ColorInput from "@shared/ui/ColorInput";
import { TAG_DEFINITIONS, tagSettings } from "../../lib/getTag";


function TagSettingsSection({ id, defaultText, defaultColor }: { id: string; defaultText: string; defaultColor: string }) {
    const settings = tagSettings(id);
    useProxy(settings);

    const enabled = settings.enabled !== false;

    return (
        <TableRowGroup title={defaultText}>
            <TableSwitchRow
                label="Show this tag"
                value={enabled}
                onValueChange={(v: boolean) => { settings.enabled = v; }}
            />
            <TextInput
                label="Tag text"
                placeholder={defaultText}
                value={settings.text ?? ""}
                editable={enabled}
                onChange={(v: string) => { settings.text = v; }}
            />
            <TableSwitchRow
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
            <TableSwitchRow
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
        </TableRowGroup>
    );
}

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <TableRowGroup title="General">
                <TableSwitchRow
                    label="Use top role color"
                    subLabel="Used when a tag has no custom color set"
                    value={!!storage.useRoleColor}
                    onValueChange={(v: boolean) => { storage.useRoleColor = v; }}
                />
            </TableRowGroup>
            {TAG_DEFINITIONS.map((def) => (
                <TagSettingsSection key={def.id} id={def.id} defaultText={def.defaultText} defaultColor={def.defaultColor} />
            ))}
        </SettingsScaffold>
    );
}
