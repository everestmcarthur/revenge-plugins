import { id } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import loadCommands from "./commands";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = guardPlugin(id, () => {
            const unregisterFns = loadCommands();
            return () => unregisterFns.forEach((fn) => fn());
        });
    },
    onUnload: () => unpatchAll()
};
