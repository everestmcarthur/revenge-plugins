import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByTypeName } from "@shared/lib/rawFind";

/** Lets the Settings screen force the patched YouBar to re-render right after a toggle changes. */
export let updateYouBar = () => {};

/**
 * `YouBarNotificationsButton` isn't guaranteed to be registered in Metro yet at the exact moment
 * onLoad runs - on a cold app start plugins can load before every screen component has actually
 * been required. The original version of this plugin did a single synchronous
 * `findByTypeName` lookup here and gave up for the whole session if it came back empty, which is
 * the "sometimes the buttons just don't show up, restarting fixes it" bug this port fixes.
 *
 * Uses rawFindByTypeName (not @vendetta/metro's findByTypeName) specifically because this call
 * gets retried by waitFor - Revenge's own findByTypeName permanently caches a "not found" result
 * and never rescans, so retrying the cached version would just hit that poisoned cache every time
 * instead of ever actually finding the component once it registers. Confirmed by reading Revenge's
 * own metro finder source.
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
    // Same lookups the original working version of this plugin used - this was a timing bug
    // (see above), not a renamed-API one, so these targets are left exactly as they were.
    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");
    const ChatIcon = getAssetIDByName("ChatIcon");
    const SettingsIcon = getAssetIDByName("SettingsIcon");

    return instead("type", YouBarNotificationsButton, (args: any[], OriginalRender: (...a: any[]) => any) => {
        try {
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
                            onPress={() => transitionModule?.transitionToGuild?.("@me")}
                        />
                    )}
                    {storage.showSettingsButton && (
                        <IconButton
                            variant={originalProps?.variant || "tertiary"}
                            size={originalProps?.size || "sm"}
                            icon={SettingsIcon}
                            onPress={() => userSettingsAction?.openUserSettings?.()}
                        />
                    )}
                    {res}
                </React.Fragment>
            );
        } catch {
            // A shape mismatch here should mean "stock YouBar, no extra buttons" - not a crash.
            return OriginalRender(...args);
        }
    });
}
