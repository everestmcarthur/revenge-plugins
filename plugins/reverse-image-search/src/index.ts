import loadCommands from "./commands";

let unregisterFns: (() => void)[] = [];

export default {
    onLoad: () => {
        unregisterFns = loadCommands();
    },
    onUnload: () => unregisterFns.forEach((fn) => fn())
};
