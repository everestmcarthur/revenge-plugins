import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByTypeName } from "@shared/lib/rawFind";

export let updateYouBar = () => {};

/**
 * Confirmed on-device, not just theorized: the exact upstream one-shot `findByTypeName` lookup at
 * onLoad is genuinely non-deterministic across app boots - it found the component on one reload and
 * came up empty on the very next one, same code, same device, nothing else changed. Metro doesn't
 * guarantee YouBarNotificationsButton's module has been required by the time a plugin's onLoad
 * runs; which reload wins that race varies. waitFor keeps checking after a first miss instead of
 * giving up for the whole session - and it has to use the passive rawFindByTypeName specifically,
 * because Revenge's own findByTypeName permanently caches a negative result and never rescans,
 * which would make retrying it pointless.
 *
 * Deliberately NOT reintroducing anything beyond this. The force-render attempts tried earlier this
 * session (walking React's DevTools fiber registry, nudging live navigation state) were aimed at a
 * different problem - buttons not appearing on a hot toggle without ever restarting - and one of
 * them caused a real regression. This only fixes the reload-timing race; "no restart ever needed"
 * is a separate, deliberately deferred piece of work.
 */
export default function patchYouBarButtons(): () => void {
    let unpatch: () => void = () => {};

    const handle = waitFor(
        () => rawFindByTypeName("YouBarNotificationsButton"),
        (YouBarNotificationsButton) => {
            unpatch = applyButtonPatch(YouBarNotificationsButton);
        }
    );

    return () => {
        handle.cancel();
        unpatch();
    };
}

function applyButtonPatch(YouBarNotificationsButton: any): () => void {
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");
    const ChatIcon = getAssetIDByName("ChatIcon");
    const SettingsIcon = getAssetIDByName("SettingsIcon");

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
