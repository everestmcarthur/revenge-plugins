import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchMoreAltsSection, { SectionRow } from "./patches/sidebarPin";
import patchContextMenu from "./patches/contextMenu";
import patchNativeSwitcher from "./lib/nativeSwitcher";
import loadCommands from "./commands";
import { ensureStorage, getSettings } from "./lib/accounts";

let unpatchSidebar: (() => void) | undefined;
let unpatchContextMenu: (() => void) | undefined;
let unpatchNativeSwitcher: (() => void) | undefined;
let unregisterCommands: (() => void)[] = [];

function buildRows(): SectionRow[] {
    if (!getSettings().addToSidebar) return [];
    return [
        {
            key: "MORE_ALTS_SWITCHER",
            title: () => "Account Switcher",
            icon: getAssetIDByName("UserIcon"),
            page: Settings
        }
    ];
}

export default {
    settings: Settings,

    onLoad() {
        ensureStorage();

        try {
            unpatchSidebar = patchMoreAltsSection(buildRows);
        } catch (e: any) {
            logger.error("[MoreAlts] Failed to patch sidebar:", e?.message ?? e);
        }

        try {
            unpatchContextMenu = patchContextMenu();
        } catch (e: any) {
            logger.error("[MoreAlts] Failed to patch context menu:", e?.message ?? e);
        }

        try {
            unpatchNativeSwitcher = patchNativeSwitcher();
        } catch (e: any) {
            logger.error("[MoreAlts] Failed to patch native switcher:", e?.message ?? e);
        }

        try {
            unregisterCommands = loadCommands();
        } catch (e: any) {
            logger.error("[MoreAlts] Failed to register commands:", e?.message ?? e);
        }
    },

    onUnload() {
        unpatchSidebar?.();
        unpatchContextMenu?.();
        unpatchNativeSwitcher?.();
        unregisterCommands.forEach((u) => u());
        unregisterCommands = [];
    }
};
