import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import { guardPlugin } from "@shared/lib/guard";
import { FluxDispatcher } from "@fpte/lib/flux";
import { UserProfileStore, UserStore } from "@fpte/lib/stores";
import {
    patchGetPurchase,
    patchGetUserProfile,
    patchUseProfileEffectSections,
    patchUseProfileTheme,
    patchUserProfileEditForm,
    patchNitroUpsellCard
} from "@fpte/patches";
import { Settings } from "@fpte/ui/pages";

/** Updates the profile theme and effect used by YouScreen and BottomTabBar. */
function updateProfileThemeAndEffect() {
    const user = UserStore.getCurrentUser();
    if (!user) return;
    const user_profile = UserProfileStore.getUserProfile(user.id);
    if (!user_profile) return;
    FluxDispatcher.dispatch({
        type: "USER_PROFILE_FETCH_SUCCESS",
        user,
        user_profile,
        connected_accounts: user_profile.connectedAccounts
    });
}

let unpatchAll: () => void = () => {};

export default {
    onLoad() {
        // The "real" picker chains Discord's own hooks onto this fiber outside React's normal
        // reconciliation, risking a "Rendered more/fewer hooks" crash - default to the safer,
        // self-contained fallback picker instead.
        storage.forceFallbackEffectPicker ??= true;

        unpatchAll = guardPlugin(id, () => applyPatches("FakeProfileThemesAndEffects", logger, {
            "purchase check": patchGetPurchase,
            "user profile data": patchGetUserProfile,
            "profile effect sections": () => {
                const unpatches = patchUseProfileEffectSections();
                return () => unpatches.forEach((u) => u());
            },
            "profile theme": patchUseProfileTheme,
            "profile edit form": patchUserProfileEditForm,
            "nitro upsell card": patchNitroUpsellCard
        }));
        updateProfileThemeAndEffect();
    },
    onUnload() {
        unpatchAll();
        updateProfileThemeAndEffect();
    },
    settings: Settings
};
