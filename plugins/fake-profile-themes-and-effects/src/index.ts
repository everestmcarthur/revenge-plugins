import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
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
        // The "real" picker (EffectPickerActionSheet.tsx) works by manually calling Discord's own
        // EditProfileEffectActionSheet as a plain function from inside this plugin's own render,
        // outside React's normal reconciliation - Discord's component's hooks end up chained onto
        // this fiber's hook list. If that component's own hook count/order ever varies, that's the
        // "Rendered more/fewer hooks" crash class, and it's the one this plugin's own settings
        // screen already had a manual override toggle for. Defaulting to the fallback picker (a
        // self-contained implementation using only its own hooks) instead of opting into that risk
        // by default - it's a real crash a user hit live opening the Effects picker.
        storage.forceFallbackEffectPicker ??= true;

        unpatchAll = applyPatches("FakeProfileThemesAndEffects", logger, {
            "purchase check": patchGetPurchase,
            "user profile data": patchGetUserProfile,
            "profile effect sections": () => {
                const unpatches = patchUseProfileEffectSections();
                return () => unpatches.forEach((u) => u());
            },
            "profile theme": patchUseProfileTheme,
            "profile edit form": patchUserProfileEditForm,
            "nitro upsell card": patchNitroUpsellCard
        });
        updateProfileThemeAndEffect();
    },
    onUnload() {
        unpatchAll();
        updateProfileThemeAndEffect();
    },
    settings: Settings
};
