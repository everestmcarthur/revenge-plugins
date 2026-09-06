import { id } from "@vendetta/plugin";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";
import Settings from "./ui/Settings";

export default {
    onLoad: () => {
        enforceBlacklistOnLoad(id);
    },
    settings: Settings
};
