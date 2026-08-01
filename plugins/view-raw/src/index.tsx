// Forked from bwlok/revenge-plugins (plugins/ViewRaw), GPLv3. Original authors: sapphire, Vendicated, Bwlok.
// https://github.com/bwlok/revenge-plugins/tree/master/plugins/ViewRaw
//
// Changes in this fork:
// - Fixed a crash on every message long-press ("Cannot read property 'type' of undefined") caused
//   by assuming Discord's ActionSheetRow icon shape without checking it first.
// - RawPage rebuilt with a search box, syntax-highlighted JSON, and clearer copy actions.
// - Added a third, name-independent fallback for finding the action sheet's row list, plus a
//   diagnostics record (visible in Settings) of which strategy matched - the original had exactly
//   two shape-specific strategies, and gave up silently if neither matched a given Discord build.
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
const { FormRow, FormIcon } = Forms;

function viewRawFormRow(navigator: () => JSX.Element) {
  return (
    <FormRow
      label="View Raw"
      leading={
        <FormIcon
          style={{ opacity: 1 }}
          source={getAssetIDByName("ic_chat_bubble_16px")}
        />
      }
      onPress={() => {
        LazyActionSheet.hideActionSheet();
        Navigation.push(navigator);
      }}
    />
  );
}

const unpatch = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  const message = msg?.message;
  if (key !== "MessageLongPressActionSheet" || !message) return;
  component.then((instance) => {
    const unpatch = after("default", instance, (_, component) => {
      React.useEffect(
        () => () => {
          unpatch();
        },
        [],
      );

      // Every branch below pokes at Discord's internal action-sheet component shape, which isn't a
      // stable API - wrapped so a shape mismatch just skips adding the button instead of crashing
      // the long-press menu for every message.
      try {
        const navigator = () => (
          <Navigator
            initialRouteName="RawPage"
            goBackOnBackPress
            screens={{
              RawPage: {
                title: "ViewRaw",
                headerLeft: modalCloseButton?.(() => Navigation.pop()),
                render: () => <RawPage message={message} />,
              },
            }}
          />
        );

        // Strategy 1: a plain list of buttons (older/simpler action sheet layouts).
        const buttons = findInReactTree(
          component,
          (x) => x?.[0]?.type?.name === "ButtonRow",
        );

        // Strategy 2: the row-group layout, where we build a fake icon element to match the
        // existing rows' internal shape.
        const actionSheetContainer = findInReactTree(
          component,
          (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
        );

        if (buttons) {
          buttons.push(viewRawFormRow(navigator));
          recordDetection("buttons");
          return;
        }

        if (actionSheetContainer && actionSheetContainer[1]) {
          const middleGroup = actionSheetContainer[1];
          const firstChild = middleGroup?.props?.children?.[0];
          const ActionSheetRow = firstChild?.type;
          const iconProps = firstChild?.props?.icon;

          if (ActionSheetRow && iconProps && Array.isArray(middleGroup?.props?.children)) {
            const viewRawButton = (
              <ActionSheetRow
                label="View Raw"
                icon={{
                  $$typeof: iconProps.$$typeof,
                  type: iconProps.type,
                  key: null,
                  ref: null,
                  props: {
                    IconComponent: () => (
                      <FormIcon
                        style={{ opacity: 1 }}
                        source={getAssetIDByName("ic_chat_bubble_32px")}
                      />
                    ),
                  },
                }}
                onPress={() => {
                  LazyActionSheet.hideActionSheet();
                  Navigation.push(navigator);
                }}
                key="view-raw"
              />
            );

            middleGroup.props.children.push(viewRawButton);
            recordDetection("actionSheetRow");
            return;
          }
        }

        // Strategy 3: name-independent fallback. Rather than matching a specific component name
        // (which changes across Discord builds/minification), look for any array where every
        // element already looks like an action sheet row - has both a label and an onPress. This
        // is a shape signature, not a name, so it survives renames that break strategies 1 and 2.
        const genericRowGroup = findInReactTree(
          component,
          (x) =>
            Array.isArray(x) &&
            x.length > 0 &&
            x.every((el) => typeof el?.props?.label === "string" && typeof el?.props?.onPress === "function"),
        );

        if (Array.isArray(genericRowGroup)) {
          genericRowGroup.push(viewRawFormRow(navigator));
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
  });
});

export default {
  onUnload: () => unpatch(),
  settings: Settings,
};
