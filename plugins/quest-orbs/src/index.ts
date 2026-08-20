import { logger } from "@vendetta";

import Settings from "./ui/Settings";
import { completeAllVideoQuests } from "./lib/questCompleter";

export default {
    onLoad: () => {
        // Fire-and-forget: never blocks Discord's own boot, and a failure here (e.g. QuestStore
        // not populated yet this session) is logged, not thrown - onLoad must not crash the app.
        completeAllVideoQuests().catch((e) => {
            logger.error(`[QuestOrbs] Auto-run on load failed: ${e}`);
        });
    },
    onUnload: () => {},
    settings: Settings
};
