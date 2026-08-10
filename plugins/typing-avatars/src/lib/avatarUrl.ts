import { findByStoreName } from "@vendetta/metro";

const UserStore = findByStoreName("UserStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");

function avatarExtension(hash: string): string {
    return hash.startsWith("a_") ? "gif" : "png";
}

// member.avatar / user.avatar are the property names Discord's client uses for a per-server /
// global avatar hash respectively - GuildMemberStore.getMember and UserStore.getUser are both
// confirmed-working lookups elsewhere in this repo (typingWrapper.ts, getTag.ts), but the avatar
// hash field itself hasn't been live-verified yet. If avatars come back broken, check these two
// property reads first via devtools eval against a real member/user record.
export function getTypingAvatarURL(guildId: string | undefined, userId: string, size = 32): string | null {
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
}
