// Forked from bwlok/revenge-plugins (plugins/ViewRaw), GPLv3. Original authors: sapphire, Vendicated, Bwlok.
// https://github.com/bwlok/revenge-plugins/tree/master/plugins/ViewRaw
import { before, after } from "@vendetta/patcher";
import { id } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { guardPlugin } from "@shared/lib/guard";
import RawPage from "./RawPage";
import { recordDetection } from "./lib/diagnostics";
import Settings from "./ui/Settings";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
  findByProps("getRenderCloseButton")?.getRenderCloseButton ??
  findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator =
  findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
const { ActionSheetRow } = findByProps("ActionSheetRow") ?? {};
const { FormRow, FormIcon } = Forms;

function buildNavigator(getMessage: () => any) {
  return () => (
    <Navigator
      initialRouteName="RawPage"
      goBackOnBackPress
      screens={{
        RawPage: {
          title: "ViewRaw",
          headerLeft: modalCloseButton?.(() => Navigation.pop()),
          render: () => <RawPage message={getMessage()} />,
        },
      }}
    />
  );
}

function openRawPage(navigator: () => JSX.Element) {
  LazyActionSheet.hideActionSheet();
  Navigation.push(navigator);
}

function formRowButton(navigator: () => JSX.Element) {
  return (
    <FormRow
      label="View Raw"
      leading={
        <FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_chat_bubble_32px")} />
      }
      onPress={() => openRawPage(navigator)}
    />
  );
}

function actionSheetRowButton(navigator: () => JSX.Element) {
  return (
    <ActionSheetRow
      label="View Raw"
      icon={<ActionSheetRow.Icon source={getAssetIDByName("ic_chat_bubble_32px")} />}
      onPress={() => openRawPage(navigator)}
      key="view-raw"
    />
  );
}

function applyViewRawPatches(): () => void {
  const patches: (() => void)[] = [];

  const unpatchOpenLazy = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  if (key !== "MessageLongPressActionSheet" || !msg?.message) return;

  component.then((instance: any) => {
    // Discord reuses the same lazy-loaded instance across opens - patch once, track the active
    // message on the instance itself.
    instance.__viewRawActiveMessage = msg.message;
    if (instance.__viewRawPatched) return;
    instance.__viewRawPatched = true;

    const unpatchDefault = after("default", instance, (_: any, component: any) => {
      try {
        if (!Navigator) {
          console.log("[ViewRaw] Error: Navigator not found - can't open RawPage");
          recordDetection("none", "Navigator not found");
          return;
        }

        const navigator = buildNavigator(() => instance.__viewRawActiveMessage);

        // Strategy 1: a plain list of buttons (older/simpler layouts).
        const buttons = findInReactTree(component, (x) => x?.[0]?.type?.name === "ButtonRow");
        if (buttons) {
          buttons.push(formRowButton(navigator));
          recordDetection("buttons");
          return;
        }

        // Strategy 2: real ActionSheetRow groups, falling back to a new group if none match.
        const groups = findInReactTree(
          component,
          (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
        );

        if (Array.isArray(groups) && groups.length && ActionSheetRow) {
          const button = actionSheetRowButton(navigator);
          let inserted = false;

          for (const group of groups) {
            const children = findInReactTree(
              group,
              (c) => Array.isArray(c) && c.some((child: any) => child?.type?.name === "ActionSheetRow"),
            );
            if (Array.isArray(children)) {
              children.push(button);
              inserted = true;
              break;
            }
          }

          if (!inserted && typeof groups.unshift === "function" && ActionSheetRow.Group) {
            groups.unshift(<ActionSheetRow.Group>{button}</ActionSheetRow.Group>);
            inserted = true;
          }

          if (inserted) {
            recordDetection("actionSheetRow");
            return;
          }
        }

        // Strategy 3: name-independent fallback matching on shape (label + onPress) instead.
        const genericRowGroup = findInReactTree(
          component,
          (x) =>
            Array.isArray(x) &&
            x.length > 0 &&
            x.every((el: any) => typeof el?.props?.label === "string" && typeof el?.props?.onPress === "function"),
        );

        if (Array.isArray(genericRowGroup)) {
          genericRowGroup.push(formRowButton(navigator));
          recordDetection("generic");
          return;
        }

        console.log("[ViewRaw] Error: Could not find ActionSheet");
        recordDetection("none");
      } catch (e) {
        console.log("[ViewRaw] Error: Failed to add View Raw button", e);
        recordDetection("none", String(e));
      }
    });

    patches.push(unpatchDefault);
  });
});

patches.push(unpatchOpenLazy);

  return () => patches.forEach((unpatch) => unpatch());
}

let unpatchAll: () => void = () => {};

export default {
  onLoad: () => {
    unpatchAll = guardPlugin(id, applyViewRawPatches);
  },
  onUnload: () => unpatchAll(),
  settings: Settings,
};
