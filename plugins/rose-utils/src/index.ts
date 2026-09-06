import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import modules from "./modules";
import { vstorage } from "./lib/Module";
import Settings from "./ui/Settings";

export default {
    onLoad() {
        if (enforceBlacklistOnLoad(id)) return;
        vstorage.modules ??= {};

        for (const module of modules) {
            try {
                if (module.storage.enabled) module.start();
            } catch (e) {
                logger.error(`[RoseUtils] Failed to start "${module.label}" on load: ${e}`);
            }
        }
    },
    onUnload() {
        for (const module of modules) {
            try {
                module.stop();
            } catch (e) {
                logger.error(`[RoseUtils] Failed to stop "${module.label}" cleanly: ${e}`);
            }
        }
    },
    settings: Settings,
};
