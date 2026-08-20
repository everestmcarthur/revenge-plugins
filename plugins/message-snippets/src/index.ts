import { id } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import loadCommands from "./commands";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = guardPlugin(id, () => {
            const unregisterFns = loadCommands();
            return () => unregisterFns.forEach((fn) => fn());
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
