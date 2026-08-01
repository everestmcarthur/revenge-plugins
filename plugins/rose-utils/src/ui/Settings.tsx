import { React, clipboard } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import modules from "../modules";
import { ModuleCategory, type AnyModule, type ModuleSetting } from "../lib/Module";

const { FormSection, FormSwitchRow, FormRow } = Forms;

function resolveSubLabel(setting: ModuleSetting, value: any): string | undefined {
    return typeof setting.subLabel === "function" ? setting.subLabel(value) : setting.subLabel;
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

const CATEGORY_ORDER: ModuleCategory[] = [ModuleCategory.Useful, ModuleCategory.Fixes, ModuleCategory.Fun];

export default function Settings() {
    return (
        <SettingsScaffold>
            <NoteBox>
                RoseUtils is a collection of small, independent utilities - toggle whichever ones
                you want. Fork of nexpid's NexxUtils, with fixes for lookups that broke on newer
                Discord versions. If a module shows an error below, tap it to copy the details for
                a bug report.
            </NoteBox>
            {CATEGORY_ORDER.flatMap((category) =>
                modules
                    .filter((m) => m.meta.category === category)
                    .map((module) => <ModuleSection key={module.id} module={module} />),
            )}
        </SettingsScaffold>
    );
}
