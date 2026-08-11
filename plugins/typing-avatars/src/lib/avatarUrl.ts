import { findByStoreName } from "@vendetta/metro";

const UserStore = findByStoreName("UserStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");

function avatarExtension(hash: string): string {
    return hash.startsWith("a_") ? "gif" : "png";
}

// member.avatar / user.avatar confirmed live via devtools eval: UserStore.getCurrentUser().avatar
// returned a real hash, and GuildMemberStore.getMember(guildId, userId).avatar exists as a field
// and is correctly null for a user with no server-specific avatar set (the fallback-to-global
// path is real and was exercised, not just theorized).
//
// The whole body is wrapped so a single bad input (e.g. a malformed userId reaching BigInt())
// degrades to "this one avatar doesn't render" instead of throwing during the message list's
// render pass - that render happens outside typingIndicator.tsx's own try/catch, which only
// guards element creation, not AvatarStack's actual render.
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
