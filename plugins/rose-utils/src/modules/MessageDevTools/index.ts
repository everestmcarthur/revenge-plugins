import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Module, ModuleCategory } from "../../lib/Module";
import { registerMessageAction, type MessageActionRow } from "../../lib/messageActionSheet";

const COPY_ICON = "ic_copy_24px";

function copy(value: string, toastLabel: string) {
    clipboard.setString(value);
    showToast(toastLabel, getAssetIDByName(COPY_ICON));
}

// Every field read below (webhookId, nonce, attachments, messageReference, type/flags/timestamps)
// is part of Discord's own public message object schema - the same shape the client already
// deserializes the gateway/REST payload into before handing it to the action sheet - not
// internal-UI guesswork, unlike the activity-ID lookup in the Developer Mode module. webhookId,
// nonce, and messageReference are confirmed live via Key Inspector Eval
// (/root/eval-for-revenge/ru/all-checks.txt) against real interaction-response and reply messages.
function webhookIdRow(message: any): MessageActionRow[] {
    const webhookId = message?.webhookId ?? message?.webhook_id;
    if (!webhookId) return [];

    return [
        {
            key: "rose-utils-copy-webhook-id",
            label: "Copy Webhook ID",
            icon: COPY_ICON,
            onPress: () => copy(String(webhookId), "Copied webhook ID to clipboard"),
        },
    ];
}

function nonceRow(message: any): MessageActionRow[] {
    const nonce = message?.nonce;
    if (!nonce) return [];

    return [
        {
            key: "rose-utils-copy-nonce",
            label: "Copy Nonce",
            icon: COPY_ICON,
            onPress: () => copy(String(nonce), "Copied nonce to clipboard"),
        },
    ];
}

function attachmentIdsRow(message: any): MessageActionRow[] {
    const attachments = message?.attachments;
    if (!Array.isArray(attachments) || !attachments.length) return [];

    const ids = attachments.map((a: any) => a?.id).filter(Boolean);
    if (!ids.length) return [];

    return [
        {
            key: "rose-utils-copy-attachment-ids",
            label: ids.length > 1 ? `Copy Attachment IDs (${ids.length})` : "Copy Attachment ID",
            icon: COPY_ICON,
            onPress: () => copy(ids.join(", "), `Copied ${ids.length} attachment ID${ids.length === 1 ? "" : "s"} to clipboard`),
        },
    ];
}

function referencedMessageIdRow(message: any): MessageActionRow[] {
    const ref = message?.messageReference ?? message?.message_reference;
    const refId = ref?.messageId ?? ref?.message_id;
    if (!refId) return [];

    return [
        {
            key: "rose-utils-copy-referenced-id",
            label: "Copy Replied-to Message ID",
            icon: COPY_ICON,
            onPress: () => copy(String(refId), "Copied replied-to message ID to clipboard"),
        },
    ];
}

function debugInfoRow(message: any): MessageActionRow[] {
    if (!message?.id) return [];

    return [
        {
            key: "rose-utils-copy-debug-info",
            label: "Copy Message Debug Info",
            sublabel: "Type, flags, and timestamps",
            icon: COPY_ICON,
            onPress: () => {
                const info = {
                    id: message.id,
                    channelId: message.channelId ?? message.channel_id,
                    type: message.type,
                    flags: message.flags,
                    timestamp: message.timestamp,
                    editedTimestamp: message.editedTimestamp ?? message.edited_timestamp,
                };
                copy(JSON.stringify(info, null, 2), "Copied message debug info to clipboard");
            },
        },
    ];
}

export default new Module({
    id: "message-dev-tools",
    label: "Message Dev Tools",
    meta: {
        sublabel: "Extra copy-ID rows in the message long-press menu, beyond what Discord's Developer Mode gives you natively",
        category: ModuleCategory.Useful,
    },
    settings: {
        copyWebhookId: {
            label: "Copy Webhook ID",
            subLabel: "For messages sent by a webhook",
            type: "toggle",
            default: true,
        },
        copyNonce: {
            label: "Copy Nonce",
            subLabel: "The client-generated ID used to match an optimistic send to its real message",
            type: "toggle",
            default: true,
        },
        copyAttachmentIds: {
            label: "Copy Attachment ID(s)",
            type: "toggle",
            default: true,
        },
        copyReferencedId: {
            label: "Copy Replied-to Message ID",
            type: "toggle",
            default: true,
        },
        copyDebugInfo: {
            label: "Copy Message Debug Info",
            subLabel: "Type, flags, and creation/edit timestamps as JSON",
            type: "toggle",
            default: true,
        },
    },
    handlers: {
        onStart() {
            const options = this.storage.options;

            if (options.copyWebhookId) this.patches.add(registerMessageAction(webhookIdRow));
            if (options.copyNonce) this.patches.add(registerMessageAction(nonceRow));
            if (options.copyAttachmentIds) this.patches.add(registerMessageAction(attachmentIdsRow));
            if (options.copyReferencedId) this.patches.add(registerMessageAction(referencedMessageIdRow));
            if (options.copyDebugInfo) this.patches.add(registerMessageAction(debugInfoRow));
        },
        onStop() {},
    },
});
