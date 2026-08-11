import { React, NavigationNative } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

const { FormSection, FormRow } = Forms;

// The mobile settings list renders a section's `label` field directly as its header text - `title`
// goes unused there (confirmed live: an internal-looking label like "ROSES_PLUGS" rendered verbatim
// instead of a real title). Raiden's Themes' own working section lookup relies on the same thing
// (label === title === "Revenge"), so both fields just carry the same human-readable string.
const SECTION_LABEL = "Rosie's Plugs";
const SECTION_TITLE = "Rosie's Plugs";

const tabsNavigationRef = findByProps("getRootNavigationRef");
const settingConstants = findByProps("SETTING_RENDERER_CONFIG");
const createListModule = findByProps("createList");
const SettingsOverviewScreen = findByName("SettingsOverviewScreen", false);
const TableRowIconModule = findByProps("TableRowIcon");

export interface SectionRow {
    key: string;
    title: () => string;
    icon?: any;
    page: React.ComponentType<any>;
}

function navigateToRow(row: SectionRow) {
    const navigation = tabsNavigationRef.getRootNavigationRef();
    const Component = row.page;
    navigation.navigate("VendettaCustomPage", {
        title: row.title(),
        render: () => React.createElement(Component),
    });
}

function buildRendererRow(row: SectionRow) {
    return {
        type: "pressable",
        useTitle: row.title,
        title: row.title,
        icon: row.icon,
        IconComponent:
            row.icon && TableRowIconModule &&
            (() => React.createElement(TableRowIconModule.TableRowIcon, { source: row.icon })),
        usePredicate: () => true,
        onPress: () => navigateToRow(row),
        withArrow: true,
    };
}

function Section({ tabs }: { tabs: SectionRow }) {
    const navigation = NavigationNative.useNavigation();

    return React.createElement(FormRow, {
        label: tabs.title(),
        leading: tabs.icon ? React.createElement(FormRow.Icon, { source: tabs.icon }) : undefined,
        trailing: React.createElement(FormRow.Arrow),
        onPress: () => {
            const Component = tabs.page;
            navigation.navigate("VendettaCustomPage", {
                title: tabs.title(),
                render: () => React.createElement(Component),
            });
        },
    });
}

function patchPanelUI(getRows: () => SectionRow[], patches: (() => void)[]) {
    const target = findByProps("renderTitle", "sections");
    if (!target) return;

    try {
        patches.push(
            after("default", target, (_: any, ret: any) => {
                const UserSettingsOverview = findInReactTree(
                    ret.props.children,
                    (n: any) => n.type?.name === "UserSettingsOverview"
                );

                if (UserSettingsOverview) {
                    patches.push(
                        after("render", UserSettingsOverview.type.prototype, (_args: any, res: any) => {
                            const sections = findInReactTree(
                                res.props.children,
                                (n: any) => n?.children?.[1]?.type === FormSection
                            )?.children;

                            if (sections) {
                                const rows = getRows();
                                rows.forEach((row, i) => {
                                    sections.splice(
                                        i,
                                        0,
                                        React.createElement(Section, { key: row.key, tabs: row })
                                    );
                                });
                            }
                        }, true)
                    );
                }
            }, true)
        );
    } catch {
        // This surface (the tablet/desktop-style settings panel) may not exist on this build at
        // all - patchTabsUI below covers the mobile settings list, which is what actually matters.
    }
}

function patchTabsUI(getRows: () => SectionRow[], patches: (() => void)[]) {
    if (!settingConstants || !tabsNavigationRef) {
        console.warn("[RosePlugs] Missing constants for tabs UI patch");
        return;
    }

    let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
        enumerable: true,
        configurable: true,
        get: () => {
            const extra: Record<string, any> = {};
            for (const row of getRows()) extra[row.key] = buildRendererRow(row);
            return { ...rendererConfigValue, ...extra };
        },
        set(v: any) { rendererConfigValue = v; },
    });

    const firstRender = Symbol("roseplugs-first-render");

    try {
        if (!createListModule) return;
        patches.push(
            after("createList", createListModule, function (args: any) {
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const [config] = args;
                const sections = config.sections;
                const rows = getRows();
                if (!rows.length || !sections) return;

                const anchorIndex = sections.findIndex((x: any) =>
                    ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                        (mod) => x.label === mod && x.title === mod
                    )
                );

                sections.splice(
                    anchorIndex >= 0 ? anchorIndex + 1 : 0,
                    0,
                    { label: SECTION_LABEL, title: SECTION_TITLE, settings: rows.map((r) => r.key) }
                );
            })
        );
    } catch {
        if (!SettingsOverviewScreen) return;
        patches.push(
            after("default", SettingsOverviewScreen, (args: any, ret: any) => {
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const { sections } = findInReactTree(ret, (i: any) => i.props?.sections)?.props ?? {};
                const rows = getRows();
                if (!rows.length || !sections) return;

                const anchorIndex = sections.findIndex((x: any) =>
                    ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                        (mod) => x.label === mod && x.title === mod
                    )
                );

                sections.splice(
                    anchorIndex >= 0 ? anchorIndex + 1 : 0,
                    0,
                    { label: SECTION_LABEL, title: SECTION_TITLE, settings: rows.map((r) => r.key) }
                );
            })
        );
    }
}

export default function patchRosiesPlugsSection(getRows: () => SectionRow[]): () => void {
    const patches: (() => void)[] = [];

    patchPanelUI(getRows, patches);
    patchTabsUI(getRows, patches);

    return () => {
        for (const p of patches) p?.();
    };
}
