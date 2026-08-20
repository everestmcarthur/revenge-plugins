import { findByStoreName } from "@vendetta/metro";
import { checkPluginStatus } from "./backend";
import { checkForUpdate } from "./reload";

const UserStore = findByStoreName("UserStore");

export function guardPlugin(pluginId: string, applyPatches: () => () => void): () => void {
    let unpatch = applyPatches();
    let unloaded = false;

    checkPluginStatus(UserStore?.getCurrentUser?.()?.id, pluginId).then((status) => {
        if (unloaded || !status.blocked) return;
        unpatch();
        unpatch = () => {};
    });

    checkForUpdate(pluginId).catch(() => {});

    return () => {
        unloaded = true;
        unpatch();
    };
}
