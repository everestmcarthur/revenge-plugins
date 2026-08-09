import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchSettings from "./patches/settings";

storage.current ??= "";

let unpatch: (() => void) | undefined;

export default {
    onLoad: () => {
        try {
            unpatch = patchSettings({
                key: "RaidensThemes",
                icon: getAssetIDByName("SettingsIcon"),
                title: () => "Raiden's Themes",
                predicate: () => true,
                page: Settings
            });
        } catch (e: any) {
            logger.error("[Raiden's Themes] Failed to patch settings:", e?.message ?? e);
        }
    },
    onUnload: () => {
        unpatch?.();
        unpatch = undefined;
    },
    settings: Settings
};
