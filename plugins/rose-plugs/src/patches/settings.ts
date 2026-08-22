import { React, NavigationNative } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

const { FormSection, FormRow } = Forms;

// The mobile settings list renders a section's `label` as its header text, not `title` - both
// fields just carry the same string.
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

// A section's row-key list is a one-time snapshot, but the live config used to rebuild fresh on
// every access - the two could disagree and leave a key the snapshot references missing from the
// config, which crashes Discord's settings code. Accumulating instead of rebuilding keeps any
// key ever referenced resolvable for good.
const rendererRowCache: Record<string, any> = {};

function cacheRows(rows: SectionRow[]) {
    for (const row of rows) rendererRowCache[row.key] = buildRendererRow(row);
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
        // This surface may not exist on this build - patchTabsUI below covers the mobile list.
    }
}

function patchTabsUI(getRows: () => SectionRow[], patches: (() => void)[]) {
    if (!settingConstants || !tabsNavigationRef) {
        console.warn("[RosePlugs] Missing constants for tabs UI patch");
        return;
    }

    // Raiden's Themes installs this same Object.defineProperty override on the same property -
    // whichever installs last wins outright (defineProperty overwrites, it doesn't chain). Re-
    // asserting ours before every read we need keeps it the most-recently-installed one regardless
    // of plugin load order.
    let baseConfigValue: any = settingConstants.SETTING_RENDERER_CONFIG;

    const configGetter = () => {
        cacheRows(getRows());
        return { ...baseConfigValue, ...rendererRowCache };
    };

    function ensureConfigOverride() {
        const current = Object.getOwnPropertyDescriptor(settingConstants, "SETTING_RENDERER_CONFIG");
        if (current?.get === configGetter) return;

        baseConfigValue = current?.get ? current.get.call(settingConstants) : (current?.value ?? baseConfigValue);

        Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
            enumerable: true,
            configurable: true,
            get: configGetter,
            set(v: any) { baseConfigValue = v; },
        });
    }

    ensureConfigOverride();

    const firstRender = Symbol("roseplugs-first-render");

    try {
        if (!createListModule) return;
        patches.push(
            after("createList", createListModule, function (args: any) {
                ensureConfigOverride();
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const [config] = args;
                const sections = config.sections;
                const rows = getRows();
                if (!rows.length || !sections) return;

                // createList is shared by every settings sub-page; scope to the
                // top-level overview screen by call stack.
                const stack = new Error().stack ?? "";
                if (!stack.includes("SettingsOverviewScreen")) return;

                cacheRows(rows);

                sections.push({ label: SECTION_LABEL, title: SECTION_TITLE, settings: rows.map((r) => r.key) });
            })
        );
    } catch {
        if (!SettingsOverviewScreen) return;
        patches.push(
            after("default", SettingsOverviewScreen, (args: any, ret: any) => {
                ensureConfigOverride();
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const { sections } = findInReactTree(ret, (i: any) => i.props?.sections)?.props ?? {};
                const rows = getRows();
                if (!rows.length || !sections) return;
                cacheRows(rows);

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
