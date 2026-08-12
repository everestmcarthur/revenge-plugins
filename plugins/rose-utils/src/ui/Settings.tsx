import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { TableRowGroup, TableSwitchRow, TableRow, TextInput } from "@shared/ui/table";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import modules from "../modules";
import { ModuleCategory, vstorage, type AnyModule, type ModuleSetting } from "../lib/Module";

const { View, Text, TouchableOpacity } = ReactNative;

// RN's Text defaults to black with no theming - illegible on Discord's dark theme otherwise.
const textColor = () => resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

function resolveSubLabel(setting: ModuleSetting, value: any): string | undefined {
    return typeof setting.subLabel === "function" ? setting.subLabel(value) : setting.subLabel;
}

function moduleMatchesQuery(module: AnyModule, query: string): boolean {
    if (!query) return true;
    const needle = query.toLowerCase();

    if (module.label.toLowerCase().includes(needle)) return true;
    if (module.meta.sublabel.toLowerCase().includes(needle)) return true;

    return Object.values(module.settings).some((setting) => {
        if (setting.label.toLowerCase().includes(needle)) return true;
        const subLabel = typeof setting.subLabel === "string" ? setting.subLabel : undefined;
        return subLabel?.toLowerCase().includes(needle) ?? false;
    });
}

function setModulesEnabled(mods: AnyModule[], enabled: boolean) {
    for (const module of mods) {
        if (module.storage.enabled !== enabled) module.toggle();
    }
}

function ModuleSettingRow({ module, settingKey }: { module: AnyModule; settingKey: string }) {
    const setting = module.settings[settingKey];
    if (setting.predicate && !setting.predicate.call(module)) return null;

    const value = module.storage.options[settingKey];
    const subLabel = resolveSubLabel(setting, value);
    const disabled = !module.storage.enabled;

    if (setting.type === "toggle") {
        return (
            <TableSwitchRow
                label={setting.label}
                subLabel={subLabel}
                value={!!value}
                disabled={disabled}
                onValueChange={(v: boolean) => {
                    module.storage.options[settingKey] = v;
                    module.restart();
                }}
            />
        );
    }

    if (setting.type === "button") {
        return (
            <TableRow
                label={setting.label}
                subLabel={subLabel}
                disabled={disabled}
                onPress={() => setting.action.call(module)}
            />
        );
    }

    if (setting.type === "text") {
        return (
            <TextInput
                label={setting.label}
                placeholder={setting.placeholder}
                value={typeof value === "string" ? value : ""}
                editable={!disabled}
                onChange={(v: string) => {
                    module.storage.options[settingKey] = v;
                }}
            />
        );
    }

    // "choose" - cycles through choices on tap instead of a full picker sheet.
    return (
        <TableRow
            label={setting.label}
            subLabel={[subLabel, value].filter(Boolean).join(" - ")}
            disabled={disabled}
            onPress={() => {
                const idx = setting.choices.indexOf(value);
                module.storage.options[settingKey] = setting.choices[(idx + 1) % setting.choices.length];
                module.restart();
            }}
        />
    );
}

function ModuleSection({ module }: { module: AnyModule }) {
    module.useRefresh();
    // useProxy covers storage reactivity for the toggle below; the custom refresh() above also
    // covers module.errors, which is plain in-memory state useProxy can't see.
    useProxy(module.storage);

    const errorEntries = Object.entries(module.errors);

    return (
        <TableRowGroup title={module.label}>
            <TableSwitchRow
                label="Enabled"
                subLabel={module.meta.sublabel}
                value={!!module.storage.enabled}
                onValueChange={() => module.toggle()}
            />
            {module.storage.enabled && Object.keys(module.settings).map((key) => (
                <ModuleSettingRow key={key} module={module} settingKey={key} />
            ))}
            {errorEntries.length > 0 && (
                <TableRow
                    label={`${errorEntries.length} error${errorEntries.length === 1 ? "" : "s"} - tap to copy`}
                    onPress={() => {
                        const report = errorEntries.map(([label, stack]) => `[${module.label}] ${label}\n${stack}`).join("\n\n");
                        clipboard.setString(report);
                        showToast("Copied - paste this when reporting the issue", undefined);
                    }}
                />
            )}
        </TableRowGroup>
    );
}

function CategoryHeader({
    category,
    mods,
    collapsed,
    onToggleCollapse,
}: {
    category: ModuleCategory;
    mods: AnyModule[];
    collapsed: boolean;
    onToggleCollapse: () => void;
}) {
    const enabledCount = mods.filter((m) => m.storage.enabled).length;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 4,
            }}
        >
            <TouchableOpacity onPress={onToggleCollapse} style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", opacity: 0.6, color: textColor() }}>
                    {collapsed ? "▸" : "▾"} {category.toUpperCase()} · {enabledCount}/{mods.length}
                </Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row" }}>
                <TouchableOpacity onPress={() => setModulesEnabled(mods, true)}>
                    <Text style={{ fontSize: 12, fontWeight: "600", opacity: 0.6, color: textColor() }}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModulesEnabled(mods, false)} style={{ marginLeft: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", opacity: 0.6, color: textColor() }}>None</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const CATEGORY_ORDER: ModuleCategory[] = [ModuleCategory.Useful, ModuleCategory.Fixes, ModuleCategory.Fun];

export default function Settings() {
    // Subscribes so the category headers' enabled counts stay in sync with toggles/bulk actions.
    for (const module of modules) module.useRefresh();

    const [query, setQuery] = React.useState("");
    const [collapsed, setCollapsed] = React.useState<Set<ModuleCategory>>(new Set());

    const searching = query.trim().length > 0;
    const visibleByCategory = CATEGORY_ORDER.map((category) => ({
        category,
        mods: modules.filter((m) => m.meta.category === category && moduleMatchesQuery(m, query.trim())),
    })).filter(({ mods }) => mods.length > 0);

    const allVisible = visibleByCategory.flatMap(({ mods }) => mods);

    return (
        <SettingsScaffold>
            <NoteBox>
                RoseUtils is a collection of small, independent utilities - toggle whichever ones
                you want. Fork of nexpid's NexxUtils, with fixes for lookups that broke on newer
                Discord versions. If a module shows an error below, tap it to copy the details for
                a bug report.
            </NoteBox>

            <View style={{ paddingHorizontal: 16 }}>
                <TextInput
                    label="Search"
                    placeholder="Search modules and settings..."
                    value={query}
                    onChange={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 }}>
                <TouchableOpacity onPress={() => setModulesEnabled(allVisible, true)}>
                    <Text style={{ fontSize: 13, fontWeight: "600", opacity: 0.75, color: textColor() }}>
                        Enable {searching ? "matching" : "all"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModulesEnabled(allVisible, false)} style={{ marginLeft: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", opacity: 0.75, color: textColor() }}>
                        Disable {searching ? "matching" : "all"}
                    </Text>
                </TouchableOpacity>
            </View>

            {allVisible.length === 0 && (
                <NoteBox>No modules or settings match "{query.trim()}".</NoteBox>
            )}

            {visibleByCategory.map(({ category, mods }) => {
                // Collapse state is ignored while searching, so a match inside a collapsed
                // category doesn't just disappear.
                const isCollapsed = !searching && collapsed.has(category);

                return (
                    <View key={category}>
                        <CategoryHeader
                            category={category}
                            mods={mods}
                            collapsed={isCollapsed}
                            onToggleCollapse={() => {
                                setCollapsed((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(category)) next.delete(category);
                                    else next.add(category);
                                    return next;
                                });
                            }}
                        />
                        {!isCollapsed && mods.map((module) => <ModuleSection key={module.id} module={module} />)}
                    </View>
                );
            })}
        </SettingsScaffold>
    );
}
