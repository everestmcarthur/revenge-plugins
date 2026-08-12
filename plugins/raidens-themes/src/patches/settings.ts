import { React, NavigationNative } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

const { FormSection, FormRow } = Forms;

// Pins a settings entry into Discord's own App Settings screen instead of leaving it buried under
// Revenge's Plugins list - ported from Commands (kmmiio99o/vd-plugins), swapped from bunny to
// Vendetta's findByProps/findByName.
const tabsNavigationRef = findByProps("getRootNavigationRef");
const settingConstants = findByProps("SETTING_RENDERER_CONFIG");
const createListModule = findByProps("createList");
const SettingsOverviewScreen = findByName("SettingsOverviewScreen", false);
const TableRowIconModule = findByProps("TableRowIcon");

function Section({ tabs }: { tabs: any }) {
    const navigation = NavigationNative.useNavigation();

    return React.createElement(FormRow, {
        label: tabs.title(),
        leading: React.createElement(FormRow.Icon, { source: tabs.icon }),
        trailing: React.createElement(React.Fragment, {}, [
            tabs.trailing ? tabs.trailing() : null,
            React.createElement(FormRow.Arrow, { key: "arrow" })
        ]),
        onPress: () => {
            const Component = tabs.page;
            navigation.navigate("VendettaCustomPage", {
                title: tabs.title(),
                render: () => React.createElement(Component)
            });
        }
    });
}

function patchPanelUI(tabs: any, patches: any[]) {
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
                                const index = sections.findIndex((c: any) =>
                                    ["BILLING_SETTINGS", "PREMIUM_SETTINGS"].includes(c?.props?.label)
                                );
                                sections.splice(
                                    -~index || 4,
                                    0,
                                    React.createElement(Section, { key: tabs.key, tabs })
                                );
                            }
                        })
                    );
                }
            }, true)
        );
    } catch {
        // This surface may not exist on this build - patchTabsUI below covers the mobile list.
    }
}

function patchTabsUI(tabs: any, patches: any[]) {
    if (!settingConstants || !tabsNavigationRef) {
        console.warn("[Raiden's Themes] Missing constants for tabs UI patch");
        return;
    }

    const row = {
        [tabs.key]: {
            type: "pressable",
            useTitle: tabs.title,
            title: tabs.title,
            icon: tabs.icon,
            IconComponent:
                tabs.icon &&
                TableRowIconModule &&
                (() => React.createElement(TableRowIconModule.TableRowIcon, { source: tabs.icon })),
            usePredicate: tabs.predicate,
            useTrailing: tabs.trailing,
            onPress: () => {
                const navigation = tabsNavigationRef.getRootNavigationRef();
                const Component = tabs.page;

                navigation.navigate("VendettaCustomPage", {
                    title: tabs.title(),
                    render: () => React.createElement(Component)
                });
            },
            withArrow: true
        }
    };

    let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
        enumerable: true,
        configurable: true,
        get: () => ({
            ...rendererConfigValue,
            ...row
        }),
        set(v: any) { rendererConfigValue = v; }
    });

    const firstRender = Symbol("raidens-themes-first-render");

    try {
        if (!createListModule) return;
        patches.push(
            after("createList", createListModule, function (args: any) {
                if (!args[0][firstRender]) {
                    args[0][firstRender] = true;

                    const [config] = args;
                    const sections = config.sections;

                    const section = sections?.find((x: any) =>
                        ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                            (mod) => x.label === mod && x.title === mod
                        )
                    );

                    if (section?.settings) {
                        section.settings = [...section.settings, tabs.key];
                    }
                }
            })
        );
    } catch {
        if (!SettingsOverviewScreen) return;
        patches.push(
            after("default", SettingsOverviewScreen, (args: any, ret: any) => {
                if (!args[0][firstRender]) {
                    args[0][firstRender] = true;

                    const { sections } = findInReactTree(
                        ret,
                        (i: any) => i.props?.sections
                    ).props;

                    const section = sections?.find((x: any) =>
                        ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                            (mod) => x.label === mod && x.title === mod
                        )
                    );

                    if (section?.settings) {
                        section.settings = [...section.settings, tabs.key];
                    }
                }
            })
        );
    }
}

export default function patchSettings(tabs: any) {
    const patches: any[] = [];
    let disabled = false;

    const realPredicate = tabs.predicate || (() => true);
    tabs.predicate = () => (disabled ? false : realPredicate());

    patchPanelUI(tabs, patches);
    patchTabsUI(tabs, patches);
    patches.push(() => (disabled = true));

    return () => {
        for (const x of patches) x?.();
    };
}
