import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { waitFor } from "../lib/waitFor";
import { rawFindByFilePath } from "../lib/rawMetro";

const { View, TouchableOpacity, Image } = ReactNative;

const TOAST_CONTAINER_FILE_PATH = "modules/toast/native/ToastContainer.tsx";

/**
 * Ground-up rewrite. Every previous approach patched YouBarNotificationsButton directly (or tried
 * to catch it via element-creation interception) and all of them failed on-device, repeatedly,
 * confirmed via Key Inspector's Eval console: the component is found and patchable, but never
 * renders again after its first mount, and there is real evidence that first mount can happen
 * before Revenge's own plugin system has even finished loading plugins - in which case no in-JS
 * patch, however early, can ever be early enough, because our code fundamentally cannot run before
 * Revenge itself runs.
 *
 * This sidesteps that entirely instead of trying to win an unwinnable race: it doesn't touch
 * YouBarNotificationsButton at all. It renders its own independent floating button row, mounted by
 * patching Discord's own ToastContainer (modules/toast/native/ToastContainer.tsx - confirmed
 * React.memo'd, confirmed its content comes from a genuine Flux store subscription
 * (useStateFromStoresArray on ToastStore), not a reanimated-only value like YouBar's badge count -
 * meaning a real toast firing causes a real React re-render here, unlike YouBar's leaf, which
 * never re-renders for any reason once mounted). Firing one toast ourselves right after patching
 * guarantees that re-render happens under our patch, instead of waiting on luck.
 *
 * Found by file path (rawFindByFilePath), not by name: ToastContainer's inner render function has
 * no recoverable name in the compiled bundle (confirmed against decompiled source), so name-based
 * matching wouldn't work here even as a fallback. File path is registration-time metadata Metro
 * attaches to every module regardless of minification, so it doesn't have that problem.
 */
export default function patchYouBarButtons(): () => void {
    let unpatchToastContainer: () => void = () => {};

    const handle = waitFor(
        () => rawFindByFilePath<any>(TOAST_CONTAINER_FILE_PATH, true),
        (ToastContainer) => {
            unpatchToastContainer = after("type", ToastContainer, (_args: any[], res: any) => (
                <React.Fragment>
                    {res}
                    <FloatingButtons />
                </React.Fragment>
            ));

            // Guarantees ToastContainer actually re-renders at least once under our patch - its
            // content is driven by a real Flux store subscription (ToastStore), so a genuine toast
            // firing is a genuine React re-render, not a hope. Without this, our injected buttons
            // would only ever appear whenever Discord's own code happens to show a toast next,
            // which could be immediate or could be a long wait depending on what the user's doing.
            showToast("YouBar+ ready", getAssetIDByName("CheckmarkIcon"));
        }
    );

    return () => {
        handle.cancel();
        unpatchToastContainer();
    };
}

function FloatingButtons() {
    useProxy(storage);

    if (!storage.showDMButton && !storage.showSettingsButton) return null;

    const userSettingsAction = findByProps("openUserSettings");
    const transitionModule = findByProps("transitionToGuild");
    const ChatIcon = getAssetIDByName("ChatIcon");
    const SettingsIcon = getAssetIDByName("SettingsIcon");

    return (
        <View pointerEvents="box-none" style={styles.container}>
            {storage.showDMButton && (
                <TouchableOpacity
                    accessibilityLabel="Direct Messages"
                    onPress={() => transitionModule?.transitionToGuild?.("@me")}
                    style={styles.button}
                >
                    <Image source={ChatIcon} style={styles.icon} />
                </TouchableOpacity>
            )}
            {storage.showSettingsButton && (
                <TouchableOpacity
                    accessibilityLabel="Settings"
                    onPress={() => userSettingsAction?.openUserSettings?.()}
                    style={styles.button}
                >
                    <Image source={SettingsIcon} style={styles.icon} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const BUTTON_SIZE = 40;

// Approximate positioning, anchored bottom-right - not pixel-matched to the native YouBar row,
// since this renders independently of it rather than inside it. Expect this to need visual
// tuning once the buttons are confirmed to actually appear reliably.
const styles = {
    container: {
        position: "absolute" as const,
        right: 12,
        bottom: 90,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        zIndex: 999,
        elevation: 999
    },
    button: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: "rgba(30,30,35,0.85)",
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: "white"
    }
};
