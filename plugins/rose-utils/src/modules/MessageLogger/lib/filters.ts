function parseIdList(raw: string | undefined): Set<string> {
    if (!raw) return new Set();
    return new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

function parseKeywordList(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export interface FilterOptions {
    ignoreBots: boolean;
    ignoreOwnMessages: boolean;
    ignoreDMs: boolean;
    ignoredChannelIds: string;
    ignoredGuildIds: string;
    ignoredUserIds: string;
    ignoredKeywords: string;
    onlyLogChannelIds: string;
}

export interface FilterContext {
    channelId?: string;
    guildId?: string;
    authorId?: string;
    isBot: boolean;
    isOwnMessage: boolean;
    content: string;
}

/** True if this message/edit/delete should be skipped entirely - never logged. */
export function shouldIgnore(ctx: FilterContext, options: FilterOptions): boolean {
    const onlyChannels = parseIdList(options.onlyLogChannelIds);
    if (onlyChannels.size > 0) {
        // Allow-list mode: everything else about the ignore lists is bypassed once this is set -
        // an explicit "only these channels" list is a stronger signal than any block-list.
        return !ctx.channelId || !onlyChannels.has(ctx.channelId);
    }

    if (options.ignoreBots && ctx.isBot) return true;
    if (options.ignoreOwnMessages && ctx.isOwnMessage) return true;
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
