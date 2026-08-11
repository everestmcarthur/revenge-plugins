export interface LoggedAttachment {
    id: string;
    filename: string;
    url: string;
    proxyUrl?: string;
    contentType?: string;
    width?: number;
    height?: number;
}

export interface LoggedMessage {
    id: string;
    channelId: string;
    guildId?: string;
    authorId: string;
    authorUsername?: string;
    authorDisplayName?: string;
    authorAvatarUrl?: string;
    content: string;
    newContent?: string;
    kind: "deleted" | "edited" | "bulk-deleted";
    loggedAt: number;
    timestamp?: string;
    attachments: LoggedAttachment[];
    embeds: any[];
    components: any[];
    stickerItems: any[];
    poll?: any;
    keptInline: boolean;
}

export interface FilterOptions {
    ignoreBots: boolean;
    ignoreOwnMessages: boolean;
    ignoreOwnEdits: boolean;
    ignoreDMs: boolean;
    ignoredChannelIds: string;
    ignoredGuildIds: string;
    ignoredUserIds: string;
    ignoredKeywords: string;
}
