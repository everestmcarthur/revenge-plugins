// Forked from bwlok/revenge-plugins (plugins/ViewRaw), GPLv3. Original authors: sapphire, Vendicated, Bwlok.
// https://github.com/bwlok/revenge-plugins/tree/master/plugins/ViewRaw
//
// Changes in this fork:
// - Fixed a crash on every message long-press ("Cannot read property 'type' of undefined") caused
//   by assuming Discord's ActionSheetRow icon shape without checking it first.
// - RawPage rebuilt with a search box, syntax-highlighted JSON, and clearer copy actions.
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import RawPage from "./RawPage";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
  findByProps("getRenderCloseButton")?.getRenderCloseButton ??
  findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator =
  findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
const { FormRow, FormIcon } = Forms;

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

        const actionSheetContainer = findInReactTree(
          component,
          (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
        );
        const buttons = findInReactTree(
          component,
          (x) => x?.[0]?.type?.name === "ButtonRow",
        );

        if (buttons) {
          buttons.push(
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
            />,
          );
        } else if (actionSheetContainer && actionSheetContainer[1]) {
          const middleGroup = actionSheetContainer[1];
          const firstChild = middleGroup?.props?.children?.[0];
          const ActionSheetRow = firstChild?.type;
          const iconProps = firstChild?.props?.icon;

          if (!ActionSheetRow || !iconProps || !Array.isArray(middleGroup?.props?.children)) {
            console.log("[ViewRaw] Error: Could not find ActionSheetRow/icon shape");
          } else {
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
          }
        } else {
          console.log("[ViewRaw] Error: Could not find ActionSheet");
        }
      } catch (e) {
        console.log("[ViewRaw] Error: Failed to add View Raw button", e);
      }
    });
  });
});

export default {
  onUnload: () => unpatch(),
};
