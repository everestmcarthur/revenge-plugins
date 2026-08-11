import { FilterOptions } from "./types";

function parseIdList(raw: string | undefined): Set<string> {
    if (!raw) return new Set();
    return new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

function parseKeywordList(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export interface FilterContext {
    channelId?: string;
    guildId?: string;
    authorId?: string;
    isBot: boolean;
    isOwnMessage: boolean;
    isEdit: boolean;
    content: string;
}

/** True if this message/edit/delete should be skipped entirely - never captured. */
export function shouldIgnore(ctx: FilterContext, options: FilterOptions): boolean {
    if (options.ignoreBots && ctx.isBot) return true;
    if (options.ignoreOwnMessages && ctx.isOwnMessage) return true;
    if (options.ignoreOwnEdits && ctx.isEdit && ctx.isOwnMessage) return true;
    if (options.ignoreDMs && !ctx.guildId) return true;
    if (ctx.channelId && parseIdList(options.ignoredChannelIds).has(ctx.channelId)) return true;
    if (ctx.guildId && parseIdList(options.ignoredGuildIds).has(ctx.guildId)) return true;
    if (ctx.authorId && parseIdList(options.ignoredUserIds).has(ctx.authorId)) return true;

    const keywords = parseKeywordList(options.ignoredKeywords);
    if (keywords.length > 0) {
        const haystack = ctx.content.toLowerCase();
        if (keywords.some((kw) => haystack.includes(kw))) return true;
    }

    return false;
}
