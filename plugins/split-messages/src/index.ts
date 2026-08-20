import { findByProps, findByStoreName } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { id, storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { checkPluginStatus } from "@shared/lib/backend";
import { checkForUpdate } from "@shared/lib/reload";
import { intoChunks } from "./lib/split";
import Settings from "./ui/Settings";

const MAX_CHUNKS = 20;

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

let unpatchMaxLength: (() => boolean) | undefined;
let unpatchSend: (() => boolean) | undefined;
let unpatchEdit: (() => boolean) | undefined;

export default {
    onLoad() {
        storage.splitOnWords ??= false;

        checkForUpdate(id).catch(() => {});

        const MaxLengthModule = findByProps("getMaxMessageLength");
        const MessageActions = findByProps("sendMessage", "editMessage");
        const UserStore = findByStoreName("UserStore");
        const ChannelStore = findByStoreName("ChannelStore");

        unpatchMaxLength = instead("getMaxMessageLength", MaxLengthModule, () => 2 ** 30);

        const maxLength = () => (UserStore.getCurrentUser()?.premiumType === 2 ? 4000 : 2000);

        const delayFor = (channelId: string) => {
            const channel = ChannelStore.getChannel(channelId);
            return Math.max((channel?.rateLimitPerUser ?? 0) * 1000, 1000);
        };

        const sendChunks = async (channelId: string, chunks: string[], template: any) => {
            for (const chunk of chunks) {
                await sleep(delayFor(channelId));
                await MessageActions._sendMessage(
                    channelId,
                    {
                        invalidEmojis: template.invalidEmojis,
                        validNonShortcutEmojis: template.validNonShortcutEmojis,
                        tts: false,
                        content: chunk,
                    },
                    {}
                );
            }
        };

        const withArg = (args: any[], index: number, value: any) => {
            const clone = args.slice();
            clone[index] = value;
            return clone;
        };

        unpatchSend = instead("sendMessage", MessageActions, (args: any[], orig: (a: any[]) => any) => {
            const [channelId, message, , options] = args;
            const content: string = message?.content ?? "";
            const limit = maxLength();
            const hasAttachments = !!options?.attachmentsToUpload?.length;

            if (content.length <= limit && !hasAttachments) return orig(args);

            const chunks = content ? intoChunks(content, limit, storage.splitOnWords) : [];
            if (chunks === false || chunks.length > MAX_CHUNKS) {
                showToast("Message too long to split", getAssetIDByName("Small"));
                return;
            }

            return (async () => {
                const status = await checkPluginStatus(UserStore.getCurrentUser()?.id, id);
                if (status.blocked) {
                    showToast("Split Messages is unavailable right now", getAssetIDByName("Small"));
                    return orig(args);
                }

                if (hasAttachments) {
                    await sendChunks(channelId, chunks, message);
                    if (chunks.length) await sleep(delayFor(channelId));
                    await orig(withArg(args, 1, { ...message, content: "" }));
                    return;
                }

                const first = { ...message, content: chunks.shift() };
                await orig(withArg(args, 1, first));
                await sendChunks(channelId, chunks, message);
            })();
        });

        unpatchEdit = instead("editMessage", MessageActions, (args: any[], orig: (a: any[]) => any) => {
            const [channelId, , message] = args;
            const content: string = message?.content ?? "";
            const limit = maxLength();

            if (content.length <= limit) return orig(args);

            const chunks = intoChunks(content, limit, storage.splitOnWords);
            if (!chunks || chunks.length > MAX_CHUNKS) {
                showToast("Message too long to split", getAssetIDByName("Small"));
                return;
            }

            return (async () => {
                const status = await checkPluginStatus(UserStore.getCurrentUser()?.id, id);
                if (status.blocked) {
                    showToast("Split Messages is unavailable right now", getAssetIDByName("Small"));
                    return orig(args);
                }

                const result = await orig(withArg(args, 2, { ...message, content: chunks.shift() }));
                await sendChunks(channelId, chunks, message);
                return result;
            })();
        });
    },
    onUnload() {
        unpatchMaxLength?.();
        unpatchSend?.();
        unpatchEdit?.();
    },
    settings: Settings,
};
