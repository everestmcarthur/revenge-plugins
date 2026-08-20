import { findByProps, findByTypeName, findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { registerPropsTransform, patchCreateElement } from "@shared/lib/createElementIntercept";
import NotificationCenter from "../ui/NotificationCenter";

// Retry logic lives one level up in index.ts, calling this repeatedly until it succeeds - keep
// this function itself simple.
export let updateYouBar = () => {};

/** Returns null (not undefined) when YouBarNotificationsButton isn't registered in Metro yet, so a caller can tell "not ready" apart from "patched, here's the unpatch fn". */
export default function patchYouBarButtons(): (() => void) | null {
    const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");

    const Navigation = findByProps("push", "pushLazy", "pop");
    const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
    const modalCloseButton =
        findByProps("getRenderCloseButton")?.getRenderCloseButton ??
        findByProps("getHeaderCloseButton")?.getHeaderCloseButton;

    const SettingsIcon = getAssetIDByName("SettingsIcon");
    const ChatIcon = getAssetIDByName("ChatIcon");

    if (!YouBarNotificationsButton) return null;

    const openInbox = () => {
        if (!Navigator || !Navigation?.push) {
            console.error("[YouBar+] Inbox: Navigator not available");
            return;
        }
        Navigation.push(() => (
            <Navigator
                initialRouteName="YouBarInbox"
                goBackOnBackPress
                screens={{
                    YouBarInbox: {
                        title: "Inbox",
                        headerLeft: modalCloseButton?.(() => Navigation.pop()),
                        render: () => <NotificationCenter />,
                    },
                }}
            />
        ));
    };

    // The native bell is one of four sibling buttons YouBarNotificationsButton renders - the
    // other three are unrelated icon buttons with raw numeric asset ids. accessibilityLabel is
    // the only reliable way to pick the real bell out (confirmed live via the fiber tree).
    const elementCleanups: (() => void)[] = [];
    patchCreateElement(elementCleanups);
    registerPropsTransform(
        (props) => !!storage.showInboxButton && props?.accessibilityLabel === "Notifications",
        (props) => ({ ...props, onPress: openInbox }),
    );

    const unpatchType = instead("type", YouBarNotificationsButton, (args: any[], OriginalRender: (...a: any[]) => any) => {
        const [, forceUpdate] = React.useReducer((x: number) => ~x, 0);

        updateYouBar = () => forceUpdate();

        const res = OriginalRender(...args);

        if (!res?.props?.children) return res;

        const IconButton = res.props.children.type;
        const originalProps = res.props.children.props;

        return (
            <React.Fragment>
                {storage.showDMButton && (
                    <IconButton
                        variant={originalProps?.variant || "tertiary"}
                        size={originalProps?.size || "sm"}
                        icon={ChatIcon}
                        onPress={() => {
                            transitionModule?.transitionToGuild?.("@me");
                        }}
                    />
                )}

                {storage.showSettingsButton && (
                    <IconButton
                        variant={originalProps?.variant || "tertiary"}
                        size={originalProps?.size || "sm"}
                        icon={SettingsIcon}
                        onPress={() => {
                            userSettingsAction?.openUserSettings?.();
                        }}
                    />
                )}

                {res}
            </React.Fragment>
        );
    });

    return () => {
        unpatchType();
        elementCleanups.forEach((fn) => fn());
    };
}
