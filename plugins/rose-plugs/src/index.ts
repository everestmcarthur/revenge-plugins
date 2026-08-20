import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { guardPlugin } from "@shared/lib/guard";
import Settings from "./ui/Settings";
import PluginsBrowser from "./ui/PluginsBrowser";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";
import { discoverRosiesPlugins } from "./patches/discoverPlugins";

let teardown: () => void = () => {};

function buildRows(): SectionRow[] {
    const rows: SectionRow[] = [
        {
            key: "ROSES_PLUGS_BROWSER",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: PluginsBrowser,
        },
        {
            key: "ROSES_PLUGS_SETTINGS",
            title: () => "RosePlugs",
            icon: getAssetIDByName("SettingsIcon"),
            page: Settings,
        },
    ];

    const discovered = discoverRosiesPlugins().filter((p) => p.settingsComponent);
    rows.push(
        ...discovered.map((plugin) => ({
            key: `ROSES_PLUGS_${plugin.id}`,
            title: () => plugin.name,
            icon: getAssetIDByName("SettingsIcon"),
            page: plugin.settingsComponent as any,
        }))
    );

    return rows;
}

export default {
    onLoad: () => {
        teardown = guardPlugin(id, () => {
            let unpatch: (() => void) | undefined;
            try {
                unpatch = patchRosiesPlugsSection(buildRows);
            } catch (e: any) {
                logger.error("[RosePlugs] Failed to patch settings:", e?.message ?? e);
            }
            return () => unpatch?.();
        });
    },
    onUnload: () => {
        teardown();
    },
    settings: Settings,
};
