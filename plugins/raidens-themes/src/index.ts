import { storage } from "@vendetta/plugin";
import Settings from "./ui/Settings";

storage.current ??= "";

export default {
    onLoad: () => {},
    onUnload: () => {},
    settings: Settings
};
