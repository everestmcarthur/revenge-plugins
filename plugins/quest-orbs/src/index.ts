import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { findByStoreName } from "@vendetta/metro";
import { checkPluginStatus } from "@shared/lib/backend";
import { checkForUpdate } from "@shared/lib/reload";

import Settings from "./ui/Settings";
import { completeAllVideoQuests } from "./lib/questCompleter";

const UserStore = findByStoreName("UserStore");

export default {
    onLoad: () => {
        checkForUpdate(id).catch(() => {});

        // Fire-and-forget: never blocks Discord's own boot, and a failure here (e.g. QuestStore
        // not populated yet this session) is logged, not thrown - onLoad must not crash the app.
        checkPluginStatus(UserStore?.getCurrentUser?.()?.id, id).then((status) => {
            if (status.blocked) return;
            completeAllVideoQuests().catch((e) => {
                logger.error(`[QuestOrbs] Auto-run on load failed: ${e}`);
            });
        });
    },
    onUnload: () => {},
    settings: Settings
};
