import { id } from "@vendetta/plugin";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import loadCommands from "./commands";
import { startScheduler, stopScheduler } from "./lib/reminders";
import Settings from "./ui/Settings";

let unregisterFns: (() => void)[] = [];

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;
        unregisterFns = loadCommands();
        startScheduler();
    },
    onUnload: () => {
        unregisterFns.forEach((fn) => fn());
        stopScheduler();
    },
    settings: Settings
};
