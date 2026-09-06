import { before } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { recordToGateway } from "@shared/lib/recordToGateway";

const ChannelStore = findByProps("getChannel", "getDMFromUserId");
const ChannelMessages = findByProps("_channelMessages");
const MessageStore = findByProps("getMessage", "getMessages");

export function patchFluxDispatch(deletedMessageMap: Map<string, any>, isEnabledRef: { current: boolean }): () => void {
    return before("dispatch", FluxDispatcher, (args: any[]) => {
        if (!isEnabledRef.current) return;

        try {
            const ev = args[0];
            if (!ev || !ev.type) return;

            /* =========================================================
                MESSAGE_DELETE
            ==========================================================*/
            if (ev.type === "MESSAGE_DELETE") {
                if (ev.otherPluginBypass || ev.manualDelete) return;

                const orig = ChannelMessages?.get?.(ev.channelId)?.get?.(ev.id) || MessageStore?.getMessage?.(ev.channelId, ev.id) || deletedMessageMap.get(ev.id)?.original;
                if (!orig?.author?.id || !orig.author.username) return;

                // Ephemeral dismiss from bots check
                if (orig.author.bot && (orig.flags === 64 || (orig.flags & 64) === 64)) return;
                if (orig.author.bot) return;

                // Empty check
                if (!orig.content && !orig.attachments?.length && !orig.embeds?.length) return;

                if (deletedMessageMap.has(ev.id)) {
                    ev.type = "MESSAGE_UPDATE";
                    ev.channelId = orig.channel_id || ev.channelId;
                    ev.message = {
                        id: ev.id,
                        channel_id: orig.channel_id || ev.channelId,
                        flags: 64,
                        was_deleted: true,
                    };
                    return args;
                }

                const guildId = ChannelStore?.getChannel?.(orig.channel_id || ev.channelId)?.guild_id;
                const gatewayOrig = recordToGateway(orig);

                ev.message = {
                    ...gatewayOrig,
                    content: orig.content,
                    channel_id: orig.channel_id || ev.channelId,
                    guild_id: guildId,
                    flags: 64,
                    was_deleted: true,
                    message_reference: orig?.message_reference || orig?.messageReference || null,
                };

                ev.type = "MESSAGE_UPDATE";
                ev.channelId = orig.channel_id || ev.channelId;
                ev.optimistic = false;
                ev.sendMessageOptions = {};
                ev.isPushNotification = false;

                deletedMessageMap.set(ev.id, { message: args, original: orig });
                return args;
            }

            /* =========================================================
                MESSAGE_UPDATE
            ==========================================================*/
            if (ev.type === "MESSAGE_UPDATE") {
                if (ev.otherPluginBypass) return;
                const msg = ev.message;
                if (!msg || msg.author?.bot) return;

                // Only handle real content edits with a valid edited_timestamp
                if (!msg.edited_timestamp || msg.edited_timestamp === "invalid_timestamp") return;

                const chId = msg.channel_id || ev.channelId;
                const id = msg.id || ev.id;
                if (!chId || !id) return;

                const orig = MessageStore?.getMessage?.(chId, id) || ChannelMessages?.get?.(chId)?.get?.(id);
                if (!orig?.author?.id || !orig.author.username) return;
                if (!orig.content || !msg.content || msg.content === orig.content) return;

                const prefix = "`[ EDITED ]`\n\n";
                const gatewayOrig = recordToGateway(orig);

                ev.message = {
                    ...gatewayOrig,
                    ...msg,
                    content: `${orig.content} ${prefix}${msg.content}`,
                    guild_id: ChannelStore?.getChannel?.(chId)?.guild_id ?? msg.guild_id,
                    edited_timestamp: "invalid_timestamp",
                    message_reference: msg?.message_reference || orig?.messageReference || null,
                };

                return args;
            }
        } catch (e) {
            console.error("[ANTIED ZERO] Flux error:", e);
        }
    });
}
