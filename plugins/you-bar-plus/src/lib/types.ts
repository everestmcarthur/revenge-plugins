export type NotificationCategory = "mentions" | "replies" | "reactions" | "other";
export type MentionSubCategory = "people" | "bot" | "role";

export interface NotificationAuthor {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string | null;
    bot?: boolean;
}

export interface NotificationItem {
    id: string;
    category: NotificationCategory;
    subCategory?: MentionSubCategory;
    title: string;
    content: string;
    guildName: string;
    channelName: string;
    guildId?: string;
    channelId?: string;
    messageId?: string;
    timestamp: string;
    author?: NotificationAuthor;
}
