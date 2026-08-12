import type { LoggedAttachment, LoggedMessage } from "./types";

// Checked in both camelCase and snake_case since MessageStore's cached objects don't consistently
// normalize every field across message sources.
function attachmentsOf(message: any): LoggedAttachment[] {
    const attachments = message?.attachments;
    if (!Array.isArray(attachments)) return [];

    return attachments.map((a: any) => ({
        id: String(a?.id ?? ""),
        filename: a?.filename ?? "attachment",
        url: a?.url ?? "",
        proxyUrl: a?.proxyURL ?? a?.proxy_url,
        contentType: a?.contentType ?? a?.content_type,
        width: a?.width,
        height: a?.height,
    }));
}

function avatarUrlOf(author: any): string | undefined {
    if (!author?.id) return undefined;
    if (!author.avatar) {
        // Discord's default avatar set - index derived from the discriminator/id the same way
        // Discord's own client picks one for users with no avatar set.
        const index = author.discriminator && author.discriminator !== "0"
            ? Number(author.discriminator) % 5
            : Number((BigInt(author.id) >> 22n) % 6n);
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }
    const ext = author.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${ext}`;
}

export function snapshotMessage(message: any, kind: LoggedMessage["kind"], newContent: string | undefined, keptInline: boolean): LoggedMessage {
    return {
        id: String(message?.id ?? ""),
        channelId: String(message?.channel_id ?? message?.channelId ?? ""),
        guildId: message?.guild_id ?? message?.guildId ?? undefined,
        authorId: message?.author?.id ?? "",
        authorUsername: message?.author?.username,
        authorDisplayName: message?.author?.globalName ?? message?.author?.global_name ?? undefined,
        authorAvatarUrl: avatarUrlOf(message?.author),
        content: message?.content ?? "",
        newContent,
        kind,
        loggedAt: Date.now(),
        timestamp: message?.timestamp ? String(message.timestamp) : undefined,
        attachments: attachmentsOf(message),
        embeds: Array.isArray(message?.embeds) ? message.embeds : [],
        components: Array.isArray(message?.components) ? message.components : [],
        stickerItems: message?.stickerItems ?? message?.sticker_items ?? [],
        poll: message?.poll,
        keptInline,
    };
}
