import { fetchPlugin, plugins, startPlugin, stopPlugin } from "@vendetta/plugins";
import { findByStoreName } from "@vendetta/metro";
import { checkPluginStatus } from "./backend";

const UserStore = findByStoreName("UserStore");

export async function checkForUpdate(pluginId: string): Promise<void> {
    const plugin = plugins[pluginId];
    if (!plugin) return;

    const userId = UserStore?.getCurrentUser?.()?.id;
    const status = await checkPluginStatus(userId, pluginId);
    if (status.blocked || !status.latestHash || status.latestHash === plugin.manifest.hash) return;

    stopPlugin(pluginId);
    await fetchPlugin(pluginId);
    await startPlugin(pluginId);
}
