import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { React, FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { storage } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import type { AntiedStorage } from "../lib/types";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const MessageStore = findByProps("getMessage", "getMessages");
const ChannelStore = findByProps("getChannel", "getDMFromUserId");
const ChannelMessages = findByProps("_channelMessages");
const { ActionSheetRow } = findByProps("ActionSheetRow") || {};

export const regexEscaper = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function patchActionSheet(deletedMessageMap: Map<string, any>, isEnabledRef: { current: boolean }): () => void {
    if (!ActionSheet?.openLazy || !ActionSheetRow) return () => {};

    return before("openLazy", ActionSheet, ([component, args, actionMessage]: any[]) => {
        if (!isEnabledRef.current) return;

        try {
            const message = actionMessage?.message;
            if (args !== "MessageLongPressActionSheet" || !message) return;

            component.then((instance: any) => {
                const unpatch = after("default", instance, (_: any, comp: any) => {
                    try {
                        React.useEffect(() => () => { unpatch(); }, []);

                        const isReplyBtn = (a: any) => a?.props?.label?.toLowerCase?.() === "reply";
                        const buttons = findInReactTree(comp, (c: any) => c?.find?.(isReplyBtn));
                        if (!buttons) return comp;

                        const position = Math.max(buttons.findIndex(isReplyBtn), buttons.length - 1);

                        let originalMessage = null;
                        if (message?.channel_id && message?.id) {
                            originalMessage = MessageStore?.getMessage?.(message.channel_id, message.id) ||
                                ChannelMessages?.get?.(message.channel_id)?.get?.(message.id);
                        }
                        if (!originalMessage) return comp;

                        const cfg = storage as AntiedStorage;
                        const escapedBuffer = regexEscaper(cfg.inputs?.editedMessageBuffer || "`[ EDITED ]`");
                        const separator = new RegExp(escapedBuffer, "gmi");
                        const hasBuffer = separator.test(message.content);

                        if (hasBuffer) {
                            const targetPos = position || 1;
                            buttons.splice(
                                targetPos,
                                0,
                                React.createElement(ActionSheetRow, {
                                    label: "Remove Edit History",
                                    subLabel: "Cute Moodle (Antied)",
                                    icon: React.createElement(ActionSheetRow.Icon, {
                                        source: getAssetIDByName("ic_edit_24px") || getAssetIDByName("ic_message_edit"),
                                    }),
                                    onPress: () => {
                                        const regexPattern = new RegExp(
                                            `(?:(?:\\s${escapedBuffer}(\\s\\(<t:\\d+:[tTdDfFR]>\\))?\\n{2})|(?:(?:\\s\\(<t:\\d+:[tTdDfFR]>\\) ${escapedBuffer}\\n{2})))`,
                                            "gm"
                                        );
                                        const lats = message?.content?.split(regexPattern);
                                        const targetMessage = lats?.[lats.length - 1] ?? message.content;

                                        FluxDispatcher.dispatch({
                                            type: "MESSAGE_UPDATE",
                                            message: {
                                                ...message,
                                                message_reference: message?.message_reference || message?.messageReference || null,
                                                content: `${targetMessage}`,
                                                guild_id: ChannelStore?.getChannel?.(originalMessage.channel_id)?.guild_id,
                                            },
                                            otherPluginBypass: true,
                                        });

                                        ActionSheet.hideActionSheet();
                                        if (cfg.inputs?.historyToast) {
                                            showToast(cfg.inputs.historyToast, getAssetIDByName(cfg.misc?.editHistoryIcon || "ic_edit_24px"));
                                        }
                                    },
                                })
                            );
                        }

                        if (!cfg.switches?.useEphemeralForDeleted && deletedMessageMap.has(message.id)) {
                            const targetPos = position || 1;
                            buttons.splice(
                                targetPos,
                                0,
                                React.createElement(ActionSheetRow, {
                                    label: "Remove Deleted Message",
                                    subLabel: "Cute Moodle (Antied)",
                                    isDestructive: true,
                                    icon: React.createElement(ActionSheetRow.Icon, {
                                        source: getAssetIDByName("ic_edit_24px") || getAssetIDByName("TrashIcon"),
                                    }),
                                    onPress: () => {
                                        FluxDispatcher.dispatch({
                                            type: "MESSAGE_DELETE",
                                            guildId: ChannelStore?.getChannel?.(originalMessage.channel_id)?.guild_id,
                                            id: message?.id,
                                            channelId: message?.channel_id,
                                            otherPluginBypass: true,
                                        });

                                        ActionSheet.hideActionSheet();
                                        showToast("[ANTIED] Message Removed", getAssetIDByName("ic_edit_24px"));
                                    },
                                })
                            );
                        }
                    } catch (e) {
                        console.error("[ANTIED] ActionSheet component error:", e);
                    }
                });
            });
        } catch (e) {
            console.error("[ANTIED] ActionSheet patch error:", e);
        }
    });
}
