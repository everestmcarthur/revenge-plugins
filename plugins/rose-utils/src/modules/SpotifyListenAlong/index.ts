import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import dark from "./dark.png";
import light from "./light.png";

import { Module, ModuleCategory } from "../../lib/Module";
import ClassicListenButton from "./components/ClassicListenButton";

// SpotifyPlayButton is a plain function component, not a class - patching the exported property
// directly works for both, and its first argument already carries {activity, style}.
const SpotifyModule = findByProps("SpotifyPlayButton");

export default new Module({
    id: "spotify-listen-along",
    label: "Add Listen Along",
    meta: {
        sublabel: "Ports the Spotify listen along feature from desktop to mobile in Spotify activities",
        category: ModuleCategory.Useful,
    },
    handlers: {
        onStart() {
            if (!SpotifyModule?.SpotifyPlayButton) return;

            this.patches.add(
                after("SpotifyPlayButton", SpotifyModule, ([props], result) => {
                    if (!result) return;
                    return React.createElement(ClassicListenButton, {
                        button: result.props,
                        activity: (props as any)?.activity,
                    });
                }),
            );
        },
        onStop() {},
    },
});
