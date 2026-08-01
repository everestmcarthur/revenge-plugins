import loadCommands from "./commands";
import Settings from "./ui/Settings";

let unregisterFns: (() => void)[] = [];

export default {
    onLoad: () => {
        unregisterFns = loadCommands();
    },
    onUnload: () => unregisterFns.forEach((fn) => fn()),
    settings: Settings
};
