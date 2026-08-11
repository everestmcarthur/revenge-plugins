import { plugins as installedPlugins, getSettings } from "@vendetta/plugins";

export interface DiscoveredPlugin {
    id: string;
    name: string;
    icon?: string;
    settingsComponent: (() => any) | null;
}

export function discoverRosiesPlugins(): DiscoveredPlugin[] {
    const result: DiscoveredPlugin[] = [];

    for (const id in installedPlugins) {
        const plugin = installedPlugins[id];
        const manifest = plugin?.manifest;
        if (!manifest || manifest.name === "RosePlugs") continue;

        const authors = manifest.authors ?? [];
        if (!authors.some((a: any) => a.name === "Rosie")) continue;

        let settingsComponent: (() => any) | null = null;
        try {
            const settingsResult = getSettings(id);
            if (typeof settingsResult === "function") settingsComponent = settingsResult;
        } catch {
            settingsComponent = null;
        }

        result.push({ id, name: manifest.name, icon: manifest.vendetta?.icon, settingsComponent });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}
