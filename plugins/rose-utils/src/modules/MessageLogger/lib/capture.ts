import type { LoggedAttachment, LoggedEmbed, LoggedMessage, LoggedReaction } from "./types";

// Every field read below is part of Discord's own public message object schema, the same shape
// message-dev-tools.ts and server-info-tools.ts already read elsewhere in this plugin - checked in
// both camelCase and snake_case since MessageStore's cached objects don't consistently normalize
// every field the same way across message sources (gateway vs. REST-backfilled history).
function attachmentsOf(message: any): LoggedAttachment[] {
    const attachments = message?.attachments;
    if (!Array.isArray(attachments)) return [];

    return attachments.map((a: any) => ({
        id: String(a?.id ?? ""),
        url: a?.url,
        proxyUrl: a?.proxyURL ?? a?.proxy_url,
        filename: a?.filename ?? "attachment",
        contentType: a?.contentType ?? a?.content_type,
        size: a?.size,
    }));
}

function embedsOf(message: any): LoggedEmbed[] {
    const embeds = message?.embeds;
    if (!Array.isArray(embeds)) return [];

    return embeds.map((e: any) => ({
        title: e?.title ?? e?.rawTitle,
        description: e?.description ?? e?.rawDescription,
        url: e?.url,
    }));
}

function reactionsOf(message: any): LoggedReaction[] {
    const reactions = message?.reactions;
    if (!Array.isArray(reactions)) return [];

    return reactions.map((r: any) => ({
        emoji: r?.emoji?.name ?? r?.emoji?.id ?? "?",
        count: r?.count ?? 0,
    }));
}

export function snapshotMessage(message: any, kind: LoggedMessage["kind"], newContent?: string): LoggedMessage {
    const ref = message?.messageReference ?? message?.message_reference;

    return {
        id: String(message?.id ?? ""),
        channelId: String(message?.channel_id ?? message?.channelId ?? ""),
        guildId: message?.guild_id ?? message?.guildId ?? undefined,
        authorId: message?.author?.id,
        authorUsername: message?.author?.username,
        authorDisplayName: message?.author?.globalName ?? message?.author?.global_name ?? undefined,
        authorIsBot: !!(message?.author?.bot ?? message?.author?.isNonUserBot?.()),
        content: message?.content ?? "",
        newContent,
        attachments: attachmentsOf(message),
        embeds: embedsOf(message),
        reactions: reactionsOf(message),
        referencedMessageId: ref?.messageId ?? ref?.message_id ?? undefined,
        messageTimestamp: message?.timestamp ? String(message.timestamp) : undefined,
        loggedAt: new Date().toISOString(),
        kind,
    };
}
