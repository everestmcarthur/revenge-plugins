import { findByProps, findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { getAssetIDByName, getAssetByID } from "@vendetta/ui/assets";
import { fluxSubscribe } from "@shared/lib/flux";

const { View, TouchableOpacity, Image } = RN;

const SpotifyStore = findByStoreName("SpotifyStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const DraftStore = findByStoreName("DraftStore");

const sendMessageModule = findByProps("sendMessage", "revealMessage");
const clearDraftModule = findByProps("clearDraft");

const sendInvite = () => {
    if (!sendMessageModule?.sendMessage || !clearDraftModule?.clearDraft) return;

    const activity = SpotifyStore?.getActivity?.();
    if (!activity?.party?.id) return;

    const channel = SelectedChannelStore?.getChannelId?.();
    if (!channel) return;

    sendMessageModule.sendMessage(
        channel,
        {
            content: DraftStore?.getDraft?.(channel, 0) ?? "",
            tts: false,
            invalidEmojis: [],
            validNonShortcutEmojis: [],
        },
        true,
        { activityAction: { activity, type: 3 } },
    );

    clearDraftModule.clearDraft(channel, 0);
};

export default function InviteButton() {
    const [, forceUpdate] = React.useReducer((x: number) => ~x, 0);
    React.useEffect(() => fluxSubscribe("SPOTIFY_PLAYER_STATE", forceUpdate));

    const canInvite = !!(sendMessageModule?.sendMessage && clearDraftModule?.clearDraft && SpotifyStore?.getActivity?.()?.party?.id);
    const asset = getAssetByID(getAssetIDByName("ic_spotify_white_16px"));

    return (
        <View style={{ opacity: canInvite ? 1 : 0.4, paddingHorizontal: 8, justifyContent: "center" }}>
            <TouchableOpacity disabled={!canInvite} onPress={sendInvite}>
                {asset?.uri ? (
                    <Image source={{ uri: asset.uri }} style={{ width: 22, height: 22 }} />
                ) : (
                    <RN.Text style={{ color: "#1ED760", fontWeight: "700" }}>♫</RN.Text>
                )}
            </TouchableOpacity>
        </View>
    );
}
