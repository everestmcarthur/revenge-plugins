import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";

let unpatch: (() => void) | undefined;

function StubPluginsScreen() {
    return null;
}

function buildRows(): SectionRow[] {
    return [
        {
            key: "ROSES_PLUGS_STUB",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: StubPluginsScreen,
        },
    ];
}

export default {
    onLoad: () => {
        try {
            unpatch = patchRosiesPlugsSection(buildRows);
        } catch (e: any) {
            logger.error("[RosePlugs] Failed to patch settings:", e?.message ?? e);
        }
    },
    onUnload: () => {
        unpatch?.();
        unpatch = undefined;
    },
    settings: Settings,
};
