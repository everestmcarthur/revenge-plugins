import { id } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import loadCommands from "./commands";
import { startScheduler, stopScheduler } from "./lib/reminders";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = guardPlugin(id, () => {
            const unregisterFns = loadCommands();
            startScheduler();
            return () => {
                unregisterFns.forEach((fn) => fn());
                stopScheduler();
            };
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
