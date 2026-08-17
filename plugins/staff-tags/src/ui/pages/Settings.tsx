import { NavigationNative, React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRow, TableRowArrow, TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { TAG_DEFINITIONS, tagSettings } from "../../lib/getTag";
import { getIcon, isValidCustomSvg, MAX_CUSTOM_SVG_LENGTH } from "../../lib/icons";
import ColorInput from "../ColorInput";
import IconPicker from "../IconPicker";


function TagSettingsSection({ id, defaultText, defaultColor }: { id: string; defaultText: string; defaultColor: string }) {
    const settings = tagSettings(id);
    useProxy(settings);
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    const enabled = settings.enabled !== false;
    const activeColor = settings.useCustomColor && settings.color ? settings.color : defaultColor;
    const iconFallback = getIcon(settings.icon)?.fallback;
    const title = iconFallback ? `${iconFallback} ${defaultText}` : defaultText;

    return (
        <TableRowGroup title={title}>
            <TableSwitchRow
                label="Show this tag"
                value={enabled}
                onValueChange={(v: boolean) => { settings.enabled = v; forceUpdate(); }}
            />
            <TextInput
                label="Tag text"
                placeholder={defaultText}
                value={settings.text ?? ""}
                editable={enabled}
                onChange={(v: string) => { settings.text = v; forceUpdate(); }}
            />
            <IconPicker
                title="Icon"
                value={settings.icon ?? "none"}
                onChange={(v: string) => {
                    settings.icon = v === "none" ? undefined : v;
                    if (v !== "none") settings.customSvg = undefined;
                    forceUpdate();
                }}
                color={activeColor}
            />
            <TextInput
                label="Custom SVG"
                placeholder="<svg>...</svg>"
                value={settings.customSvg ?? ""}
                multiline
                maxLength={MAX_CUSTOM_SVG_LENGTH}
                editable={enabled}
                onChange={(v: string) => {
                    settings.customSvg = v || undefined;
                    if (v) settings.icon = undefined;
                    forceUpdate();
                }}
            />
            {!!settings.customSvg && !isValidCustomSvg(settings.customSvg) && (
                <NoteBox>Invalid SVG markup - this tag will show without an icon until it's fixed.</NoteBox>
            )}
            {!!settings.customSvg && (
                <TextInput
                    label="Fallback text for chat"
                    placeholder="Icons can't render in chat, only member list & profile"
                    value={settings.customSvgFallback ?? ""}
                    editable={enabled}
                    onChange={(v: string) => { settings.customSvgFallback = v; forceUpdate(); }}
                />
            )}
            <TableSwitchRow
                label="Icon only"
                subLabel="Hide the text label, show just the icon"
                value={!!settings.iconOnly}
                disabled={!enabled || !(settings.icon || settings.customSvg)}
                onValueChange={(v: boolean) => { settings.iconOnly = v; forceUpdate(); }}
            />
            <TableSwitchRow
                label="Custom color"
                subLabel={`Default: ${defaultColor}`}
                value={!!settings.useCustomColor}
                disabled={!enabled}
                onValueChange={(v: boolean) => { settings.useCustomColor = v; forceUpdate(); }}
            />
            {settings.useCustomColor && (
                <ColorInput
                    title="Color"
                    value={settings.color}
                    placeholder={defaultColor}
                    onChange={(v: string) => { settings.color = v; forceUpdate(); }}
                />
            )}
            <TableSwitchRow
                label="Gradient"
                subLabel="Member list & profile only, chat tags stay solid"
                value={!!settings.useGradient}
                disabled={!enabled}
                onValueChange={(v: boolean) => { settings.useGradient = v; forceUpdate(); }}
            />
            {settings.useGradient && (
                <ColorInput
                    title="Gradient color"
                    value={settings.gradientColor}
                    onChange={(v: string) => { settings.gradientColor = v; forceUpdate(); }}
                />
            )}
        </TableRowGroup>
    );
}

export default function Settings() {
    useProxy(storage);
    const navigation = NavigationNative.useNavigation();

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
            <TableRowGroup title="Tags">
                {TAG_DEFINITIONS.map((def) => {
                    const settings = tagSettings(def.id);
                    const iconFallback = getIcon(settings.icon)?.fallback;
                    const label = iconFallback ? `${iconFallback} ${def.defaultText}` : def.defaultText;

                    return (
                        <TableRow
                            key={def.id}
                            label={label}
                            subLabel={settings.enabled === false ? "Disabled" : "Enabled"}
                            trailing={<TableRowArrow />}
                            onPress={() => navigation.navigate("VendettaCustomPage", {
                                title: def.defaultText,
                                render: () => (
                                    <SettingsScaffold>
                                        <TagSettingsSection id={def.id} defaultText={def.defaultText} defaultColor={def.defaultColor} />
                                    </SettingsScaffold>
                                )
                            })}
                        />
                    );
                })}
            </TableRowGroup>
        </SettingsScaffold>
    );
}
