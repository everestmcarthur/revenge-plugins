import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";
import { discoverRosiesPlugins } from "./patches/discoverPlugins";

let unpatch: (() => void) | undefined;

function StubPluginsScreen() {
    return null;
}

function buildRows(): SectionRow[] {
    const rows: SectionRow[] = [
        {
            key: "ROSES_PLUGS_BROWSER",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: StubPluginsScreen,
        },
    ];

    for (const plugin of discoverRosiesPlugins()) {
        if (!plugin.settingsComponent) continue;
        rows.push({
            key: `ROSES_PLUGS_${plugin.id}`,
            title: () => plugin.name,
            page: plugin.settingsComponent as any,
        });
    }

    return rows;
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
