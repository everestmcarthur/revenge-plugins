export interface LoggedAttachment {
    id: string;
    url?: string;
    proxyUrl?: string;
    filename: string;
    contentType?: string;
    size?: number;
}

export interface LoggedEmbed {
    title?: string;
    description?: string;
    url?: string;
}

export interface LoggedReaction {
    emoji: string;
    count: number;
}

export interface LoggedMessage {
    id: string;
    channelId: string;
    guildId?: string;
    authorId?: string;
    authorUsername?: string;
    authorDisplayName?: string;
    /** True if content itself came from a bot/webhook - useful for filtering the viewer after the fact. */
    authorIsBot?: boolean;
    content: string;
    /** Only set for "edited" entries - the content the message was changed to. */
    newContent?: string;
    attachments: LoggedAttachment[];
    embeds: LoggedEmbed[];
    reactions: LoggedReaction[];
    /** The message this one was replying to, if any. */
    referencedMessageId?: string;
    /** When the original message was sent, if known. */
    messageTimestamp?: string;
    /** When this entry was captured - used for the age-based prune, distinct from the message's own timestamp. */
    loggedAt: string;
    kind: "deleted" | "edited";
}
