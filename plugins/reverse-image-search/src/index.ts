import { id } from "@vendetta/plugin";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import loadCommands from "./commands";

let unregisterFns: (() => void)[] = [];

export default {
    onLoad: () => {
        if (enforceBlacklistOnLoad(id)) return;
        unregisterFns = loadCommands();
    },
    onUnload: () => unregisterFns.forEach((fn) => fn())
};
