import { findByProps, findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { registerTypeDetector, registerIntercept, registerPropsTransform, patchCreateElement } from "@shared/lib/createElementIntercept";
import NotificationCenter from "../ui/NotificationCenter";

// Retry logic lives one level up in index.ts, calling this repeatedly until it succeeds - keep
// this function itself simple.
export let updateYouBar = () => {};

// findByTypeName + instead("type", ...) used to patch this, but that mutates whatever object
// Metro's search hands back - which isn't reliably the same reference Discord's own render call
// site reads from in this bundle (confirmed live: the property write didn't stick, and a fresh
// findByTypeName call moments later returned undefined). registerTypeDetector instead captures
// the exact type value at the actual createElement/jsx call site, so there's no reference
// mismatch to go stale.
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

    // The native bell is one of four sibling buttons YouBarNotificationsButton renders - the
    // other three are unrelated icon buttons with raw numeric asset ids. accessibilityLabel is
    // the only reliable way to pick the real bell out (confirmed live via the fiber tree).
    registerPropsTransform(
        (props) => !!storage.showInboxButton && props?.accessibilityLabel === "Notifications",
        (props) => ({ ...props, onPress: openInbox }),
    );

    registerTypeDetector(
        "you-bar-plus-notifications-button",
        (type) => typeof type === "function" && type.name === "YouBarNotificationsButton",
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

                        {res}
                    </React.Fragment>
                );
            };

            registerIntercept(YouBarNotificationsButton, PatchedYouBarNotificationsButton);
        },
        { persistent: true },
    );

    return () => cleanups.forEach((fn) => fn());
}
