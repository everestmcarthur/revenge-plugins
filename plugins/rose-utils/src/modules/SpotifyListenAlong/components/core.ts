import { findByProps, findByStoreName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { fluxSubscribe } from "@shared/lib/flux";

const SpotifyProtocolStore = findByStoreName("SpotifyProtocolStore");
const SpotifyStore = findByStoreName("SpotifyStore");
const UserStore = findByStoreName("UserStore");

const { play, sync } = findByProps("play", "sync") ?? {};

interface Activity {
    party: { id: `${string}:${string}` };
}
export interface ListenButtonProps {
    button: any;
    activity: Activity;
}

export function doSync(disabled: string | false, activity: Activity, userId: string) {
    if (typeof disabled === "string") return showToast(disabled, undefined);
    if (!play || !sync) return showToast("Couldn't find Spotify's sync action - this feature may be unavailable on your Discord version.", undefined);

    if (SpotifyStore?.getActivity()) return sync(activity, userId);

    fluxSubscribe("SPOTIFY_PLAYER_STATE", () => sync(activity, userId), true);
    play(activity, userId);
}

export function useListenButton(activity: ListenButtonProps["activity"]): {
    disabled: false | string;
    userId: string;
} {
    const [val, forceUpdate] = React.useReducer((x: number) => ~x, 0);
    React.useEffect(() => fluxSubscribe("SPOTIFY_PLAYER_STATE", forceUpdate));

    const userId = activity.party.id.split(":")[1];
    const logic = React.useMemo(() => {
        const selfUserId = UserStore?.getCurrentUser?.()?.id;
        const selfActivity = SpotifyStore?.getActivity?.() as Activity | undefined;
        const hasConnectedAccount = !!SpotifyStore?.hasConnectedAccount?.();
        const canPlaySpotify = !!SpotifyStore?.getActiveSocketAndDevice?.() || !!SpotifyProtocolStore?.isProtocolRegistered?.();

        return {
            isYou: selfUserId === userId,
            isListeningAlong: selfActivity?.party?.id === activity.party.id,
            isPlayable: hasConnectedAccount && canPlaySpotify,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, activity, val]);

    let disabled: false | string = false;
    if (logic.isYou) disabled = "Listen along with someone else, not yourself.";
    else if (logic.isListeningAlong) disabled = "You're already along for this ride.";
    else if (!logic.isPlayable) disabled = "Spotify is not detected";

    return { disabled, userId };
}

export function useLoading() {
    const [loading, setLoading] = React.useState(false);

    return {
        loading,
        trigger: () => (setLoading(true), setTimeout(() => setLoading(false), 5_000)),
    };
}
