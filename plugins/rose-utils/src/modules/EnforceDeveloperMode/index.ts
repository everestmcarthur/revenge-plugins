import { findByProps } from "@vendetta/metro";
import { fluxSubscribe } from "@shared/lib/flux";
import { Module, ModuleCategory } from "../../lib/Module";

// Confirmed against decompiled current-build Discord source: Developer Mode is a proto-backed
// setting exposed as DeveloperMode.getSetting()/updateSetting(bool), part of the same
// modules/user_settings/UserSettings.tsx module that exports every other appearance/advanced
// setting (DarkSidebar, MessageDisplayCompact, etc - all built the same way via defineProtoSetting).
// It resets itself more than it should on Revenge - rather than guess at why, this just re-asserts
// it every time the user's settings proto changes, which is the same event Discord's own settings
// UI reacts to.
const UserSettingsModule = findByProps("DeveloperMode", "DarkSidebar");

export default new Module({
    id: "enforce-developer-mode",
    label: "Enforce Developer Mode",
    meta: {
        sublabel: "Keeps Developer Mode switched on - it tends to reset itself on Revenge-based clients",
        category: ModuleCategory.Fixes,
    },
    handlers: {
        onStart() {
            const DeveloperMode = UserSettingsModule?.DeveloperMode;
            if (!DeveloperMode?.getSetting || !DeveloperMode?.updateSetting) return;

            const enforce = () => {
                try {
                    if (!DeveloperMode.getSetting()) DeveloperMode.updateSetting(true);
                } catch {
                    // Best-effort - if this particular check throws, the next settings change retries it.
                }
            };

            enforce();
            this.patches.add(fluxSubscribe("USER_SETTINGS_PROTO_UPDATE", enforce));

            // Belt and suspenders: if whatever resets this doesn't go through
            // USER_SETTINGS_PROTO_UPDATE for some reason, this still catches it within 5s instead
            // of staying off for the rest of the session.
            const interval = setInterval(enforce, 5000);
            this.patches.add(() => clearInterval(interval));
        },
        onStop() {},
    },
});
