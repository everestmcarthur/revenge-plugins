import SpotifyListenAlong from "./SpotifyListenAlong";
import TenorGifFix from "./TenorGifFix";
import SendSpotifyInvite from "./SendSpotifyInvite";
import Minimod from "./Minimod";
import ColorfulChannels from "./ColorfulChannels";
import EnforceDeveloperMode from "./EnforceDeveloperMode";

// BetterComponents (Material-style Switch/Toast/Alert redesign) isn't ported - it needs
// react-native-reanimated, which isn't part of this build, and it was already disabled by
// default upstream due to known issues ("the great component functionification of 2025").
export default [SpotifyListenAlong, TenorGifFix, SendSpotifyInvite, Minimod, ColorfulChannels, EnforceDeveloperMode];
