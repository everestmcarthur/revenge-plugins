import { findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";

// Reset to Purple-EyeZ's original upstream logic, verbatim aside from the import path
// (@revenge-mod/metro -> @vendetta/metro, since this repo only has the vendetta-compat alias
// configured) - no retry loop, no raw* passive finder, no forced re-render. Every one of those
// layers added this session was meant to fix "sometimes needs a reload," but on the actual device
// buttons stopped appearing at all, even after ten restarts - worse than upstream's own documented
// "requires a restart" baseline. Resetting to the exact known-quantity upstream version first, to
// find out whether the *added* logic was the actual problem or something else in this port
// (a renamed lookup, a build difference) was always broken and just wasn't visible under the retry
// logic's own try/catch swallowing it.
export let updateYouBar = () => {};

export default function patchYouBarButtons(): () => void {
    const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");

    const SettingsIcon = getAssetIDByName("SettingsIcon");
    const ChatIcon = getAssetIDByName("ChatIcon");

    if (!YouBarNotificationsButton) return () => {};

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
