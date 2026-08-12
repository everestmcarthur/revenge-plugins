import { findByStoreName } from "@vendetta/metro";

const UserStore = findByStoreName("UserStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");

function avatarExtension(hash: string): string {
    return hash.startsWith("a_") ? "gif" : "png";
}

// Wrapped so a bad input (e.g. a malformed userId reaching BigInt()) degrades to "this one avatar
// doesn't render" instead of throwing during the message list's render pass, which happens outside
// typingIndicator.tsx's own try/catch.
export function getTypingAvatarURL(guildId: string | undefined, userId: string, size = 32): string | null {
    try {
        if (!userId) return null;

        const member = guildId ? GuildMemberStore?.getMember?.(guildId, userId) : null;
        const guildAvatarHash = member?.avatar;
        if (guildId && guildAvatarHash) {
            return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${guildAvatarHash}.${avatarExtension(guildAvatarHash)}?size=${size * 2}`;
        }

        const user = UserStore?.getUser?.(userId);
        const globalAvatarHash = user?.avatar;
        if (globalAvatarHash) {
            return `https://cdn.discordapp.com/avatars/${userId}/${globalAvatarHash}.${avatarExtension(globalAvatarHash)}?size=${size * 2}`;
        }

        // Discord's default avatar for users on the modern username system (no discriminator):
        // index = (snowflake >> 22) % 6. BigInt is required - the shift loses precision as a Number.
        const defaultIndex = Number((BigInt(userId) >> 22n) % 6n);
        return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    } catch {
        return null;
    }
}
