import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import dark from "./dark.png";
import light from "./light.png";

import { Module, ModuleCategory } from "../../lib/Module";
import ClassicListenButton from "./components/ClassicListenButton";

// Confirmed against decompiled current-build Discord source (app/modules/now_playing/native/
// UserActivitySpotify.tsx): SpotifyPlayButton is a plain function component now, not a class -
// `after("render", SpotifyPlayButton.prototype, ...)` is why this threw "render is not a
// function" on every activity render. Patching the exported property directly works for both
// function and class components, and the function's own first argument already carries
// { activity, style } directly - no need to dig through fiber internals for it anymore.
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
