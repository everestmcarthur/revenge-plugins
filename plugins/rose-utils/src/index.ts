import { logger } from "@vendetta";
import { id } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import modules from "./modules";
import { vstorage } from "./lib/Module";
import Settings from "./ui/Settings";

let teardown: () => void = () => {};

export default {
    onLoad() {
        vstorage.modules ??= {};

        teardown = guardPlugin(id, () => {
            for (const module of modules) {
                try {
                    if (module.storage.enabled) module.start();
                } catch (e) {
                    logger.error(`[RoseUtils] Failed to start "${module.label}" on load: ${e}`);
                }
            }
            return () => {
                for (const module of modules) {
                    try {
                        module.stop();
                    } catch (e) {
                        logger.error(`[RoseUtils] Failed to stop "${module.label}" cleanly: ${e}`);
                    }
                }
            };
        });
    },
    onUnload() {
        teardown();
    },
    settings: Settings,
};
