import { findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { waitFor } from "@shared/lib/waitFor";

export type YouBarButtonAction = "none" | "dms" | "settings";

export const YOU_BAR_BUTTON_CHOICES: YouBarButtonAction[] = ["none", "dms", "settings"];

export const YOU_BAR_BUTTON_LABELS: Record<YouBarButtonAction, string> = {
    none: "None",
    dms: "Direct Messages",
    settings: "Settings"
};

/** Lets the Settings screen force the patched YouBar to re-render right after a slot changes. */
export let updateYouBar = () => {};

/**
 * `YouBarNotificationsButton` isn't guaranteed to be registered in Metro yet at the exact moment
 * onLoad runs - on a cold app start plugins can load before every screen component has actually
 * been required. The original version of this plugin did a single synchronous
 * `findByTypeName` lookup here and gave up for the whole session if it came back empty, which is
 * the "sometimes the buttons just don't show up, restarting fixes it" bug this port fixes -
 * `waitFor` keeps retrying until the component shows up (or this patch gets unloaded first,
 * which cancels the pending wait).
 */
export default function patchYouBarButtons(): () => void {
    let unpatch: () => void = () => {};

    const handle = waitFor(
        () => findByTypeName("YouBarNotificationsButton"),
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
    const icons: Partial<Record<YouBarButtonAction, number | undefined>> = {
        dms: getAssetIDByName("ChatIcon"),
        settings: getAssetIDByName("SettingsIcon")
    };

    const runAction = (action: YouBarButtonAction) => {
        if (action === "dms") transitionModule?.transitionToGuild?.("@me");
        else if (action === "settings") userSettingsAction?.openUserSettings?.();
    };

    return instead("type", YouBarNotificationsButton, (args: any[], OriginalRender: (...a: any[]) => any) => {
        try {
            const [, forceUpdate] = React.useReducer((x: number) => ~x, 0);
            updateYouBar = () => forceUpdate();

            const res = OriginalRender(...args);
            if (!res?.props?.children) return res;

            const IconButton = res.props.children.type;
            const originalProps = res.props.children.props;
            // Two independent slots, rendered left to right - each can be off, DMs, or Settings.
            const slots: YouBarButtonAction[] = [storage.slot1, storage.slot2];

            return (
                <React.Fragment>
                    {slots.map((action, i) =>
                        action === "none" ? null : (
                            <IconButton
                                key={`you-bar-plus-${i}`}
                                variant={originalProps?.variant || "tertiary"}
                                size={originalProps?.size || "sm"}
                                icon={icons[action]}
                                onPress={() => runAction(action)}
                            />
                        )
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
