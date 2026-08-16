import { findByProps, findByStoreName } from "@vendetta/metro";
import { before, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { intoChunks } from "./lib/split";
import Settings from "./ui/Settings";

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

let unpatchMaxLength: (() => boolean) | undefined;
let unpatchSend: (() => boolean) | undefined;

export default {
    onLoad() {
        storage.splitOnWords ??= false;

        const MaxLengthModule = findByProps("getMaxMessageLength");
        const MessageActions = findByProps("sendMessage", "editMessage");
        const UserStore = findByStoreName("UserStore");
        const ChannelStore = findByStoreName("ChannelStore");

        unpatchMaxLength = instead("getMaxMessageLength", MaxLengthModule, () => 2 ** 30);

        unpatchSend = before("sendMessage", MessageActions, (args: any[]) => {
            const [channelId, message] = args;
            const content: string = message?.content ?? "";
            const maxLength = UserStore.getCurrentUser()?.premiumType === 2 ? 4000 : 2000;
            if (content.length <= maxLength) return;

            const chunks = intoChunks(content, maxLength, storage.splitOnWords);
            if (!chunks) {
                message.content = "";
                showToast("Message too long to split", getAssetIDByName("Small"));
                return;
            }

            message.content = chunks.shift();

            const channel = ChannelStore.getChannel(channelId);
            const delay = Math.max((channel?.rateLimitPerUser ?? 0) * 1000, 1000);

            (async () => {
                for (const chunk of chunks) {
                    await sleep(delay);
                    await MessageActions._sendMessage(
                        channelId,
                        {
                            invalidEmojis: message.invalidEmojis,
                            validNonShortcutEmojis: message.validNonShortcutEmojis,
                            tts: false,
                            content: chunk,
                        },
                        {}
                    );
                }
            })();
        });
    },
    onUnload() {
        unpatchMaxLength?.();
        unpatchSend?.();
    },
    settings: Settings,
};
