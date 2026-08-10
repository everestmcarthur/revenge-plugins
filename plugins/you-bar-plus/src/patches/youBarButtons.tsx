import { findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";

// Keep the actual patch logic here dead simple - a previous attempt to fix the load-order race
// by adding retry/re-render logic directly into this function made buttons stop appearing at all.
// The retry now lives one level up in index.ts instead, calling this repeatedly until it succeeds.
export let updateYouBar = () => {};

/** Returns null (not undefined) when YouBarNotificationsButton isn't registered in Metro yet, so a caller can tell "not ready" apart from "patched, here's the unpatch fn". */
export default function patchYouBarButtons(): (() => void) | null {
    const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");

    const SettingsIcon = getAssetIDByName("SettingsIcon");
    const ChatIcon = getAssetIDByName("ChatIcon");

    if (!YouBarNotificationsButton) return null;

    return instead("type", YouBarNotificationsButton, (args: any[], OriginalRender: (...a: any[]) => any) => {
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
}
