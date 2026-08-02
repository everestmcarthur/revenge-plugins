import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByTypeName } from "@shared/lib/rawFind";
import { patchCreateElement, registerTypeDetector } from "@shared/lib/createElementIntercept";

export let updateYouBar = () => {};

function isYouBarNotificationsButton(type: any): boolean {
    return (
        type?.name === "YouBarNotificationsButton" ||
        type?.displayName === "YouBarNotificationsButton" ||
        type?.type?.name === "YouBarNotificationsButton" ||
        type?.type?.displayName === "YouBarNotificationsButton"
    );
}

/**
 * Confirmed on-device that a metro-search-based lookup (whether the original one-shot
 * findByTypeName, or this repo's own waitFor + passive rawFindByTypeName retry) is fundamentally
 * racing against something it can't always win: YouBarNotificationsButton is a React.memo'd leaf
 * that, once mounted, appears to never render again for the rest of the session (also confirmed
 * on-device - patching it and watching for 20+ real seconds on the main screen never saw another
 * render). If that first, only mount happens before our search finds and patches the component,
 * the patch is permanently too late no matter how many times the search retries afterward.
 *
 * registerTypeDetector sidesteps the race by watching element *creation* instead of searching the
 * module registry after the fact: the moment ANY code calls createElement/jsx with this component
 * as `type` - which is necessarily the actual live reference already, there's no way to call it any
 * earlier - we grab it and patch immediately, before that render even happens. This still needs
 * patchCreateElement to have installed its React.createElement/jsx-runtime hooks before that first
 * call, but jsx-runtime is about as foundational and early-loaded a module as React itself, since
 * literally nothing can render via JSX without it - a much safer bet than waiting on a specific leaf
 * UI component to register.
 *
 * The waitFor + rawFindByTypeName search stays too, purely as a fallback for the case where the
 * component was already mounted (and thus already searchable) *before* this plugin's onLoad even
 * ran - e.g. toggled on well after a cold boot completed - since in that case there's no future
 * creation call left to intercept. Both paths funnel through the same `patchOnce`, deduped by
 * reference, so if both somehow fire for the same live component it only gets patched once.
 */
export default function patchYouBarButtons(): () => void {
    const cleanups: (() => void)[] = [];
    let buttonUnpatch: () => void = () => {};
    let patchedTarget: any = null;

    function patchOnce(target: any) {
        if (!target || target === patchedTarget) return;
        patchedTarget = target;
        buttonUnpatch = applyButtonPatch(target);
    }

    patchCreateElement(cleanups);
    registerTypeDetector(isYouBarNotificationsButton, patchOnce);

    const handle = waitFor(() => rawFindByTypeName("YouBarNotificationsButton"), patchOnce);
    cleanups.push(() => handle.cancel());

    return () => {
        buttonUnpatch();
        cleanups.forEach((fn) => fn());
    };
}

function applyButtonPatch(YouBarNotificationsButton: any): () => void {
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
