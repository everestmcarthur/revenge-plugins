// Forked from bwlok/revenge-plugins (plugins/ViewRaw), GPLv3. Original authors: sapphire, Vendicated, Bwlok.
// https://github.com/bwlok/revenge-plugins/tree/master/plugins/ViewRaw
//
// Changes in this fork:
// - Fixed a crash on every message long-press ("Cannot read property 'type' of undefined") caused
//   by assuming Discord's ActionSheetRow icon shape without checking it first.
// - RawPage rebuilt with a search box, syntax-highlighted JSON, and clearer copy actions.
// - Action-sheet insertion rewritten using the technique from fshinz/Revenge-Plugins'
//   MoveForwardButton/FastCopyUserID: build the button from the real ActionSheetRow component
//   (via findByProps("ActionSheetRow"), with its own .Icon/.Group) instead of fabricating a fake
//   icon element by copying $$typeof/type off a sibling - and fall back to creating a brand new
//   group if no existing group can be found, rather than giving up.
// - Guards against re-patching the same action sheet instance twice (Discord appears to reuse the
//   same lazy-loaded instance across opens), and against a missing Navigator lookup.
// - Diagnostics (visible in Settings) record which strategy matched, or why none did.
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
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

const patches: (() => void)[] = [];

const unpatchOpenLazy = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  if (key !== "MessageLongPressActionSheet" || !msg?.message) return;

  component.then((instance: any) => {
    // Discord appears to reuse the same lazy-loaded instance across every action sheet open, so
    // this only patches it once and tracks the active message on the instance itself - patching on
    // every open would stack duplicate buttons (and duplicate patches) after enough long-presses.
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

        // Strategy 1: a plain list of buttons (older/simpler action sheet layouts).
        const buttons = findInReactTree(component, (x) => x?.[0]?.type?.name === "ButtonRow");
        if (buttons) {
          buttons.push(formRowButton(navigator));
          recordDetection("buttons");
          return;
        }

        // Strategy 2: real ActionSheetRow groups. Search every group for one that already has
        // ActionSheetRow-shaped children, insert there - and if none match, create a brand new
        // group at the top rather than giving up (this is the actual difference from before).
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

        // Strategy 3: name-independent fallback. Look for any array where every element already
        // looks like an action sheet row (has both a label and an onPress) - a shape signature
        // rather than a name, so it survives renames that break strategies 1 and 2.
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

export default {
  onUnload: () => patches.forEach((unpatch) => unpatch()),
  settings: Settings,
};
