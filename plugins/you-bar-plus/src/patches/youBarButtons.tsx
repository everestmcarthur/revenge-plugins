import { findByProps, findByName, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { registerTypeDetector, registerIntercept, registerPropsTransform, patchCreateElement } from "@shared/lib/createElementIntercept";
import NotificationCenter from "../ui/NotificationCenter";

// Retry logic lives one level up in index.ts, calling this repeatedly until it succeeds - keep
// this function itself simple.
export let updateYouBar = () => {};

export default function patchYouBarButtons(): () => void {
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");

    const Navigation = findByProps("push", "pushLazy", "pop");
    const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
    const modalCloseButton =
        findByProps("getRenderCloseButton")?.getRenderCloseButton ??
        findByProps("getHeaderCloseButton")?.getHeaderCloseButton;

    const SettingsIcon = getAssetIDByName("SettingsIcon");
    const ChatIcon = getAssetIDByName("ChatIcon");
    const BellIcon = getAssetIDByName("BellIcon") || getAssetIDByName("NotificationBellIcon");

    const TargetNotificationsButton = findByTypeName("YouBarNotificationsButton");

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

    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    // Matches the notification button reliably even if Discord localizes or changes accessibilityLabel
    registerPropsTransform(
        (props) => {
            if (!storage.showInboxButton) return false;
            const label = props?.accessibilityLabel?.toLowerCase();
            return label === "notifications" || label === "inbox" || props?.icon === BellIcon;
        },
        (props) => ({
            ...props,
            onPress: openInbox,
        }),
    );

    registerTypeDetector(
        "you-bar-plus-notifications-button",
        (type) => {
            // Check direct Metro resolution first to bypass production Hermes type.name mangling
            if (TargetNotificationsButton && type === TargetNotificationsButton) return true;
            return typeof type === "function" && (
                type.name === "YouBarNotificationsButton" ||
                type.displayName === "YouBarNotificationsButton"
            );
        },
        (YouBarNotificationsButton: any) => {
            const PatchedYouBarNotificationsButton = (props: any) => {
                const [, forceUpdate] = React.useReducer((x: number) => ~x, 0);
                updateYouBar = () => forceUpdate();

                const res = YouBarNotificationsButton(props);

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

                        {storage.showInboxButton !== false && res}
                    </React.Fragment>
                );
            };

            registerIntercept(YouBarNotificationsButton, PatchedYouBarNotificationsButton);
        },
        { persistent: true },
    );

    return () => cleanups.forEach((fn) => fn());
}
