import SpotifyListenAlong from "./SpotifyListenAlong";
import SendSpotifyInvite from "./SendSpotifyInvite";
import Minimod from "./Minimod";
import ColorfulChannels from "./ColorfulChannels";
import DeveloperMode from "./DeveloperMode";
import MessageDevTools from "./MessageDevTools";
import SnowflakeTools from "./SnowflakeTools";
import ServerInfoTools from "./ServerInfoTools";
import MessageLogger from "./MessageLogger";

// BetterComponents (Material-style Switch/Toast/Alert redesign) isn't ported - it needs
// react-native-reanimated, which isn't part of this build, and it was already disabled by
// default upstream due to known issues ("the great component functionification of 2025").
// TenorGifFix was dropped from this module list at the user's request.
export default [
    SpotifyListenAlong,
    SendSpotifyInvite,
    Minimod,
    ColorfulChannels,
    DeveloperMode,
    MessageDevTools,
    SnowflakeTools,
    ServerInfoTools,
    MessageLogger,
];
