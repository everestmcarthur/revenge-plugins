import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { React, FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { findByProps } from "@vendetta/metro";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const MessageStore = findByProps("getMessage", "getMessages");
const ChannelStore = findByProps("getChannel", "getDMFromUserId");
const ChannelMessages = findByProps("_channelMessages");
const { ActionSheetRow } = findByProps("ActionSheetRow") || {};

export const regexEscaper = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function patchActionSheet(isEnabledRef: { current: boolean }): () => void {
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

                        const editedTag = "`[ EDITED ]`";
                        const separator = new RegExp(regexEscaper(editedTag), "gmi");
                        if (separator.test(message.content)) {
                            buttons.splice(
                                position || 1,
                                0,
                                React.createElement(ActionSheetRow, {
                                    label: "Remove Edit History",
                                    subLabel: "Antied Zero",
                                    icon: React.createElement(ActionSheetRow.Icon, {
                                        source: getAssetIDByName("ic_edit_24px") || getAssetIDByName("ic_message_edit"),
                                    }),
                                    onPress: () => {
                                        const regexPattern = new RegExp(`(?:\\s${regexEscaper(editedTag)}\\n{2})`, "gm");
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
                                        showToast("Edit history removed", getAssetIDByName("ic_edit_24px"));
                                    },
                                })
                            );
                        }
                    } catch (e) {
                        console.error("[ANTIED ZERO] ActionSheet component error:", e);
                    }
                });
            });
        } catch (e) {
            console.error("[ANTIED ZERO] ActionSheet patch error:", e);
        }
    });
}
