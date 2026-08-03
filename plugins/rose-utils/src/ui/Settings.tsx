import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import modules from "../modules";
import { ModuleCategory, vstorage, type AnyModule, type ModuleSetting } from "../lib/Module";

const { View, Text, TouchableOpacity } = ReactNative;
const { FormSection, FormSwitchRow, FormRow, FormInput } = Forms;

// Raw Text below this point (the category header and bulk-action links) had no explicit color at
// all - illegible black-on-black on Discord's dark theme, since RN's Text defaults to black with no
// theming of its own. Same resolveSemanticColorSafe fallback-chain pattern used everywhere else.
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
            <FormSwitchRow
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
            <FormRow
                label={setting.label}
                subLabel={subLabel}
                disabled={disabled}
                onPress={() => setting.action.call(module)}
            />
        );
    }

    if (setting.type === "text") {
        return (
            <FormInput
                title={setting.label}
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
        <FormRow
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
    // Belt and suspenders alongside the custom refresh() pub-sub above: module.storage.enabled is
    // read for the switch's `value` prop right below, and useProxy is the same storage-reactivity
    // mechanism every other plugin's settings screen in this repo already relies on for a toggle to
    // visually update immediately - this repo's own custom listeners system covers module.errors
    // too (plain in-memory state, not part of storage, so useProxy alone can't see it), which is
    // why that mechanism exists at all rather than being replaceable by useProxy outright.
    useProxy(module.storage);

    const errorEntries = Object.entries(module.errors);

    return (
        <FormSection title={module.label}>
            <FormSwitchRow
                label="Enabled"
                subLabel={module.meta.sublabel}
                value={!!module.storage.enabled}
                onValueChange={() => module.toggle()}
            />
            {module.storage.enabled && Object.keys(module.settings).map((key) => (
                <ModuleSettingRow key={key} module={module} settingKey={key} />
            ))}
            {errorEntries.length > 0 && (
                <FormRow
                    label={`${errorEntries.length} error${errorEntries.length === 1 ? "" : "s"} - tap to copy`}
                    onPress={() => {
                        const report = errorEntries.map(([label, stack]) => `[${module.label}] ${label}\n${stack}`).join("\n\n");
                        clipboard.setString(report);
                        showToast("Copied - paste this when reporting the issue", undefined);
                    }}
                />
            )}
        </FormSection>
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
    // Every module's own toggle already re-renders its own ModuleSection via module.useRefresh()
    // inside ModuleSection - but the category headers here (enabled counts) live in this parent
    // component, which isn't otherwise subscribed to anything. Subscribing every module here too,
    // in this same fixed order every render, keeps those counts in sync with both individual
    // toggles and the bulk All/None actions below.
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
                <FormInput
                    title="Search"
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
