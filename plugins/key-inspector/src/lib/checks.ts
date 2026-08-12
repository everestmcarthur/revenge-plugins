import { find, findByName, findByProps, findByPropsAll, findByStoreName, findByTypeNameAll } from "@vendetta/metro";
import { semanticColors, rawColors } from "@vendetta/ui";

export interface CheckResult {
    label: string;
    found: boolean;
    detail: string;
}

interface Check {
    label: string;
    run: () => any;
}

// Every internal lookup this repo's plugins depend on - add to this list whenever a new plugin
// introduces one.
const CHECKS: Check[] = [
    // Staff Tags
    { label: 'findByProps("computePermissions", "canEveryoneRole")', run: () => findByProps("computePermissions", "canEveryoneRole") },
    { label: 'findByProps("getBotLabel")', run: () => findByProps("getBotLabel") },
    { label: 'findByName("DisplayName", false)', run: () => findByName("DisplayName", false) },
    { label: 'findByName("HeaderName", false)', run: () => findByName("HeaderName", false) },
    { label: 'findByName("getTagProperties", false)', run: () => findByName("getTagProperties", false) },
    { label: 'findByTypeNameAll("UserRow")', run: () => findByTypeNameAll("UserRow") },

    // RoleColorEverywhere
    { label: 'findByStoreName("ThemeStore")', run: () => findByStoreName("ThemeStore") },
    { label: 'findByStoreName("GuildMemberStore")', run: () => findByStoreName("GuildMemberStore") },
    { label: 'findByStoreName("GuildStore")', run: () => findByStoreName("GuildStore") },
    { label: 'findByStoreName("ChannelStore")', run: () => findByStoreName("ChannelStore") },
    { label: 'findByStoreName("UserStore")', run: () => findByStoreName("UserStore") },
    { label: 'findByStoreName("RelationshipStore")', run: () => findByStoreName("RelationshipStore") },
    { label: 'findByName("RowManager", false)', run: () => findByName("RowManager", false) },
    { label: 'findByProps("TYPING_WRAPPER_HEIGHT")', run: () => findByProps("TYPING_WRAPPER_HEIGHT") },
    { label: 'findByName("VoiceUserConnected", false)', run: () => findByName("VoiceUserConnected", false) },
    { label: 'find(resolveSemanticColor via default.internal)', run: () => find((m: any) => m?.default?.internal?.resolveSemanticColor) },
    { label: 'find(resolveSemanticColor via meta)', run: () => find((m: any) => m?.meta?.resolveSemanticColor) },

    // PronounDB
    { label: 'find(UserProfileContent)', run: () => find((m: any) => m?.type?.name === "UserProfileContent") },
    { label: 'find(UserProfile)', run: () => find((m: any) => m?.type?.name === "UserProfile") },
    { label: 'findByName("UserProfileSection", false)', run: () => findByName("UserProfileSection", false) },

    // Message Snippets / Reminders / Urban Dictionary
    { label: 'findByProps("sendMessage", "sendBotMessage")', run: () => findByProps("sendMessage", "sendBotMessage") },
    { label: 'findByProps("sendBotMessage") (single prop, matches Revenge core)', run: () => findByProps("sendBotMessage") },

    // ViewRaw
    { label: 'findByProps("openLazy", "hideActionSheet")', run: () => findByProps("openLazy", "hideActionSheet") },
    { label: 'findByProps("push", "pushLazy", "pop")', run: () => findByProps("push", "pushLazy", "pop") },
    { label: 'findByProps("getRenderCloseButton")', run: () => findByProps("getRenderCloseButton") },
    { label: 'findByProps("getHeaderCloseButton")', run: () => findByProps("getHeaderCloseButton") },
    { label: 'findByName("Navigator")', run: () => findByName("Navigator") },

    // CopyRoleColor
    { label: 'findByName("ThemedRolePill", false)', run: () => findByName("ThemedRolePill", false) },
    { label: 'findByName("RolePill", false)', run: () => findByName("RolePill", false) },

    // FakeProfileThemesAndEffects (in progress)
    { label: 'findByProps("saveProfileChanges")', run: () => findByProps("saveProfileChanges") },
    { label: 'findByProps("useAvatarColors")', run: () => findByProps("useAvatarColors") },
    { label: 'findByProps("useThemeContext")', run: () => findByProps("useThemeContext") },
    { label: 'findByProps("getProfileTheme")', run: () => findByProps("getProfileTheme") },
    { label: 'findByProps("ThemeContextProvider")', run: () => findByProps("ThemeContextProvider") },
    { label: 'findByName("ProfileEffectRecord", false)', run: () => findByName("ProfileEffectRecord", false) },
    { label: 'findByStoreName("UserProfileStore")', run: () => findByStoreName("UserProfileStore") },
    { label: 'findByStoreName("CollectiblesPurchaseStore")', run: () => findByStoreName("CollectiblesPurchaseStore") },
    { label: 'findByStoreName("ProfileEffectStore")', run: () => findByStoreName("ProfileEffectStore") },
    { label: 'findByName("GuildProfileEditForm", false) (currently dead/unused patch)', run: () => findByName("GuildProfileEditForm", false) },
    { label: 'findByName("UserProfileEditForm", false)', run: () => findByName("UserProfileEditForm", false) },
    { label: 'findByName("useProfileTheme", false)', run: () => findByName("useProfileTheme", false) },
    { label: 'findByName("useProfileThemeColors", false)', run: () => findByName("useProfileThemeColors", false) },
    { label: 'findByPropsAll("NONE_ITEM")', run: () => findByPropsAll("NONE_ITEM") },
    { label: 'findByProps("Radius")', run: () => findByProps("Radius") },
    { label: 'findByProps("Spacing")', run: () => findByProps("Spacing") },
    { label: 'findByProps("SafeAreaContext")', run: () => findByProps("SafeAreaContext") },
    { label: 'findByName("useWindowDimensions")', run: () => findByName("useWindowDimensions") },
    { label: 'findByProps("IconSizes")', run: () => findByProps("IconSizes") },
    { label: 'findByName("FlashList")', run: () => findByName("FlashList") },
    { label: 'findByProps("Svg")', run: () => findByProps("Svg") },
    { label: 'findByProps("PressableOpacity")', run: () => findByProps("PressableOpacity") },
    { label: 'findByProps("TextStyleSheet")', run: () => findByProps("TextStyleSheet") },
    { label: 'findByProps("BottomSheet")', run: () => findByProps("BottomSheet") },
    { label: 'findByProps("ActionSheet")', run: () => findByProps("ActionSheet") },
    { label: 'findByProps("BottomSheetScrollView")', run: () => findByProps("BottomSheetScrollView") },
    { label: 'findByProps("showActionSheet")', run: () => findByProps("showActionSheet") },
    { label: 'findByName("EditProfileEffectActionSheet")', run: () => findByName("EditProfileEffectActionSheet") },
    { label: 'findByName("showCustomColorPickerActionSheet")', run: () => findByName("showCustomColorPickerActionSheet") },
    { label: 'findByProps("triggerHapticFeedback")', run: () => findByProps("triggerHapticFeedback") },

    // Color tokens referenced by FPTE specifically
    { label: 'semanticColors.HEADER_SECONDARY', run: () => semanticColors?.HEADER_SECONDARY },
    { label: 'semanticColors.BACKGROUND_ACCENT', run: () => semanticColors?.BACKGROUND_ACCENT },
    { label: 'semanticColors.BACKGROUND_PRIMARY', run: () => semanticColors?.BACKGROUND_PRIMARY },
    { label: 'semanticColors.BACKGROUND_FLOATING', run: () => semanticColors?.BACKGROUND_FLOATING },
    { label: 'semanticColors.BUTTON_OUTLINE_BRAND_BORDER_ACTIVE', run: () => semanticColors?.BUTTON_OUTLINE_BRAND_BORDER_ACTIVE },
    { label: 'semanticColors.TEXT_NORMAL', run: () => semanticColors?.TEXT_NORMAL }
];

function describe(value: any): string {
    if (value == null) return "NOT FOUND";
    if (typeof value === "object") {
        const keys = Object.keys(value);
        return `found (${keys.length} key${keys.length === 1 ? "" : "s"})`;
    }
    return `found (${typeof value})`;
}

export function runAllChecks(): CheckResult[] {
    return CHECKS.map(({ label, run }) => {
        try {
            const value = run();
            return { label, found: value != null, detail: describe(value) };
        } catch (e) {
            return { label, found: false, detail: `threw: ${e}` };
        }
    });
}

export function formatReport(results: CheckResult[]): string {
    const missing = results.filter((r) => !r.found);
    const lines = [
        `Key Inspector report - ${new Date().toISOString()}`,
        `${results.length} checked, ${missing.length} missing`,
        "",
        ...results.map((r) => `[${r.found ? "OK" : "MISSING"}] ${r.label} -> ${r.detail}`),
        "",
        `semanticColors keys (${Object.keys(semanticColors ?? {}).length}):`,
        ...Object.keys(semanticColors ?? {}).sort(),
        "",
        `rawColors keys (${Object.keys(rawColors ?? {}).length}):`,
        ...Object.keys(rawColors ?? {}).sort()
    ];

    return lines.join("\n");
}
