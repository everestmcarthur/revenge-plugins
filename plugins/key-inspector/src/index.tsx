import { id } from "@vendetta/plugin";
import { checkForUpdate } from "@shared/lib/reload";
import Settings from "./ui/Settings";

export default {
    onLoad: () => {
        checkForUpdate(id).catch(() => {});
    },
    settings: Settings
};
