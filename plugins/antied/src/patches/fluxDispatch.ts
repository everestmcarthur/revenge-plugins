import { before } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { FluxDispatcher } from "@vendetta/metro/common";
import { recordToGateway } from "@shared/lib/recordToGateway";
import type { AntiedStorage } from "../lib/types";

const ChannelStore = findByProps("getChannel", "getDMFromUserId");
const ChannelMessages = findByProps("_channelMessages");
const MessageStore = findByProps("getMessage", "getMessages");
const UserStore = findByStoreName("UserStore");
const AuthStore = findByStoreName("AuthenticationStore") || findByProps("getToken");

function getCurrentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id || AuthStore?.getId?.() || AuthStore?.getCurrentUser?.()?.id;
}

const now = () => Date.now();
const tsStyle = () => {
    const s = (storage as AntiedStorage).switches?.timestampStyle;
    return s && "tTdDfFR".includes(s) ? s : "R";
};

export function patchFluxDispatch(deletedMessageMap: Map<string, any>, isEnabledRef: { current: boolean }): () => void {
    return before("dispatch", FluxDispatcher, (args: any[]) => {
        if (!isEnabledRef.current) return;

        try {
            const ev = args[0];
            if (!ev || !ev.type) return;

            const cfg = storage as AntiedStorage;
            const currentUserId = getCurrentUserId();

            /* =========================================================
                MESSAGE_DELETE
            ==========================================================*/
            if (ev.type === "MESSAGE_DELETE") {
                if (!cfg.switches?.enableMD || ev.otherPluginBypass || ev.manualDelete) return;

                const orig = ChannelMessages?.get?.(ev.channelId)?.get?.(ev.id) || MessageStore?.getMessage?.(ev.channelId, ev.id) || deletedMessageMap.get(ev.id)?.original;
                if (!orig?.author?.id || !orig.author.username) return;

                // Ephemeral message dismiss check
                if (orig?.author?.bot && (orig?.flags === 64 || (orig?.flags & 64) === 64)) return;

                // Empty message check
                if (!orig.content && !orig.attachments?.length && !orig.embeds?.length && !orig.components?.length) return;

                // Bot check
                if (cfg.switches.ignoreBots && (orig.author.bot || orig.author.isNonUserBot?.())) return;

                // Own message check
                if (cfg.switches.ignoreOwnMessages && orig.author.id === currentUserId) return;

                // Ignored users list check
                if (cfg.inputs?.ignoredUserList?.length) {
                    if (cfg.inputs.ignoredUserList.some((u) => u.id === orig.author.id || u.username === orig.author.username)) return;
                }

                if (deletedMessageMap.has(ev.id)) {
                    ev.type = "MESSAGE_UPDATE";
                    ev.channelId = orig.channel_id || ev.channelId;
                    ev.message = {
                        id: ev.id,
                        channel_id: orig.channel_id || ev.channelId,
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
                MESSAGE_DELETE_BULK
            ==========================================================*/
            if (ev.type === "MESSAGE_DELETE_BULK") {
                if (!cfg.switches?.enableMD || ev.otherPluginBypass || !Array.isArray(ev.ids)) return;

                for (const id of ev.ids) {
                    const orig = ChannelMessages?.get?.(ev.channelId)?.get?.(id) || MessageStore?.getMessage?.(ev.channelId, id);
                    if (!orig?.author?.id) continue;
                    if (cfg.switches.ignoreBots && (orig.author.bot || orig.author.isNonUserBot?.())) continue;
                    if (cfg.switches.ignoreOwnMessages && orig.author.id === currentUserId) continue;

                    deletedMessageMap.set(id, { original: orig });

                    const gatewayOrig = recordToGateway(orig);
                    FluxDispatcher.dispatch({
                        type: "MESSAGE_UPDATE",
                        channelId: ev.channelId,
                        message: {
                            ...gatewayOrig,
                            was_deleted: true,
                        },
                        otherPluginBypass: true,
                    });
                }
                return;
            }

            /* =========================================================
                MESSAGE_UPDATE
            ==========================================================*/
            if (ev.type === "MESSAGE_UPDATE") {
                if (!cfg.switches?.enableMU || ev.otherPluginBypass) return;
                const msg = ev.message;
                if (!msg) return;

                // A MESSAGE_UPDATE is ONLY a real content edit if edited_timestamp is present and not synthetic
                if (!msg.edited_timestamp || msg.edited_timestamp === "invalid_timestamp") return;

                const chId = msg.channel_id || ev.channelId;
                const id = msg.id || ev.id;
                if (!chId || !id) return;

                const orig = MessageStore?.getMessage?.(chId, id) || ChannelMessages?.get?.(chId)?.get?.(id);
                if (!orig?.author?.id) return;

                if (cfg.switches.ignoreBots && (orig.author.bot || orig.author.isNonUserBot?.())) return;
                if (cfg.switches.ignoreOwnMessages && orig.author.id === currentUserId) return;

                if (!orig.content || !msg.content || msg.content === orig.content) return;

                if (cfg.inputs?.ignoredUserList?.length) {
                    if (cfg.inputs.ignoredUserList.some((u) => u.id === orig.author.id || u.username === orig.author.username)) return;
                }

                const editedTag = cfg.inputs?.editedMessageBuffer || "`[ EDITED ]`";
                if (orig.content.includes(editedTag) && orig.content.endsWith(msg.content)) return;

                const time = cfg.switches?.addTimestampForEdits ? `(<t:${Math.floor(now() / 1000)}:${tsStyle()}>)` : null;
                const tsPos = cfg.misc?.timestampPos === "BEFORE";

                let prefix = editedTag;
                prefix = time ? (tsPos ? `${time} ${prefix}\n\n` : `${prefix} ${time}\n\n`) : `${prefix}\n\n`;

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
        } catch (e: any) {
            console.error("[ANTIED] Flux dispatch error:", e?.message ?? e);
        }
    });
}
