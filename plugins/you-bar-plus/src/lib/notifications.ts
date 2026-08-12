import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { fluxSubscribe } from "@shared/lib/flux";
import type { MentionSubCategory, NotificationItem } from "./types";

// Ported from fshinz/Revenge-Plugins' BetterInbox (credit: shin) - merged in here so only one
// plugin ever patches YouBarNotificationsButton, since two independent instead() patches on the
// same component is what caused the hook-order crash this merge exists to fix.

const UserStore = findByStoreName("UserStore");
const ChannelStore = findByStoreName("ChannelStore");
const GuildStore = findByStoreName("GuildStore");
const MessageStore = findByStoreName("MessageStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const RelationshipStore = findByStoreName("RelationshipStore");

// 0 Playing, 1 Streaming, 2 Listening, 3 Watching, 4 Custom, 5 Competing - Discord's public
// Gateway ActivityType enum, stable across clients/builds.
const ACTIVITY_VERBS: Record<number, string> = {
    0: "Playing",
    1: "Streaming",
    2: "Listening to",
    3: "Watching",
    5: "Competing in",
};

// Last-seen activity signature per user, so PRESENCE_UPDATE's frequent re-fires for the same
// ongoing activity (elapsed time ticking, etc.) don't spam a fresh notification every time.
const lastActivitySignature = new Map<string, string>();

// RelationshipTypes.PENDING_INCOMING - confirmed against the decompiled Discord bundle
// (handleRelationshipAdd), stable across builds since it's foundational to the whole friends
// system: 0 NONE, 1 FRIEND, 2 BLOCKED, 3 PENDING_INCOMING, 4 PENDING_OUTGOING, 5 IMPLICIT.
const RELATIONSHIP_PENDING_INCOMING = 3;

let memoryNotifications: NotificationItem[] = [];
let saveTimeout: ReturnType<typeof setTimeout> | undefined;

function syncStorageDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        storage.notifications = memoryNotifications.slice(0, 100);
    }, 3000);
}

function pushNotification(item: NotificationItem) {
    if (memoryNotifications.some((n) => n.id === item.id)) return;
    memoryNotifications = [item, ...memoryNotifications];
    syncStorageDebounced();
}

export function getNotifications(): NotificationItem[] {
    return memoryNotifications;
}

function processMentionMessage(channelId: string, messageId: string, rawMsg?: any) {
    try {
        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser) return;

        const msg = MessageStore?.getMessage?.(channelId, messageId) || rawMsg;
        const channel = ChannelStore?.getChannel?.(channelId);
        if (!msg || !channel) return;

        const author = msg.author || UserStore?.getUser?.(msg.author?.id);
        if (!author || author.id === currentUser.id) return;

        const guild = channel.guild_id ? GuildStore?.getGuild?.(channel.guild_id) : undefined;
        const guildName = guild?.name || (channel.isGroupDM?.() ? "Group DM" : "Direct Message");
        const channelName = channel.name ? `#${channel.name}` : "DM";
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const isReply = msg.type === 19 || msg.referenced_message?.author?.id === currentUser.id;

        const category: "mentions" | "replies" = isReply ? "replies" : "mentions";
        let subCategory: MentionSubCategory = "people";

        if (author.bot) {
            subCategory = "bot";
        } else if (msg.mention_roles?.length > 0 || msg.mentionRoles?.length > 0) {
            subCategory = "role";
        }

        pushNotification({
            id: msg.id || `${Date.now()}`,
            category,
            subCategory,
            title: isReply
                ? `${author.globalName || author.username || "Someone"} replied to you`
                : subCategory === "role"
                    ? `${author.globalName || author.username || "Someone"} mentioned a role you have`
                    : `${author.globalName || author.username || "Someone"} mentioned you`,
            content: msg.content || "",
            guildName,
            channelName,
            guildId: guild?.id,
            channelId,
            messageId: msg.id,
            timestamp,
            author,
        });
    } catch (err) {
        console.error("[YouBar+] Inbox mention process error:", err);
    }
}

function handleIncomingMessage(payload: any) {
    try {
        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser) return;

        const msg = payload?.message || payload;
        if (!msg || !msg.channel_id) return;
        if (msg.author?.id === currentUser.id) return;

        const isDirectMention = msg.mentions?.some((u: any) => u.id === currentUser.id);
        const isReplyToMe = msg.referenced_message?.author?.id === currentUser.id;

        let isRoleMention = false;
        const msgRoles = msg.mention_roles || msg.mentionRoles || [];
        if (msgRoles.length > 0 && msg.guild_id) {
            const myMember = GuildMemberStore?.getMember?.(msg.guild_id, currentUser.id);
            const myRoles: string[] = myMember?.roles || [];
            isRoleMention = msgRoles.some((roleId: string) => myRoles.includes(roleId));
        }

        if (!isDirectMention && !isReplyToMe && !isRoleMention) return;

        processMentionMessage(msg.channel_id, msg.id, msg);
    } catch (err) {
        console.error("[YouBar+] Inbox incoming message error:", err);
    }
}

function handleReactionAdd(payload: any) {
    try {
        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser) return;

        const channelId = payload.channel_id || payload.channelId;
        const targetMessageId = payload.message_id || payload.messageId;
        const reactorId = payload.user_id || payload.userId;
        if (reactorId === currentUser.id) return;

        // Must positively confirm the reacted-to message is one of ours - if it isn't cached
        // locally (common; reaction events fire for any message you're viewing, not just your
        // own), this used to fall through and record the reaction anyway instead of skipping it.
        const targetMessage = MessageStore?.getMessage?.(channelId, targetMessageId);
        if (!targetMessage || targetMessage.author?.id !== currentUser.id) return;

        const channel = ChannelStore?.getChannel?.(channelId);
        const guild = channel?.guild_id ? GuildStore?.getGuild?.(channel.guild_id) : undefined;
        const guildName = guild?.name || "Direct Message";
        const channelName = channel?.name ? `#${channel.name}` : "DM";
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const reactorUser = payload.member?.user || payload.user || UserStore?.getUser?.(reactorId);
        const finalAuthor = reactorUser || {
            id: reactorId,
            username: payload.member?.nick || "Someone",
            globalName: payload.member?.nick || "Someone",
            avatar: null,
        };

        const reactorName = finalAuthor.globalName || finalAuthor.username || "Someone";
        const emojiName = payload.emoji?.name || "an emoji";

        pushNotification({
            id: `react-${targetMessageId}-${reactorId}`,
            category: "reactions",
            title: `${reactorName} reacted ${emojiName}`,
            content: targetMessage?.content ? `"${targetMessage.content}"` : `Reacted to your message in ${channelName}`,
            guildName,
            channelName,
            guildId: guild?.id,
            channelId,
            messageId: targetMessageId,
            timestamp,
            author: finalAuthor,
        });
    } catch (err) {
        console.error("[YouBar+] Inbox reaction error:", err);
    }
}

function handleRelationshipAdd(payload: any) {
    try {
        const relationship = payload?.relationship;
        if (!relationship || relationship.type !== RELATIONSHIP_PENDING_INCOMING) return;

        const user = relationship.user;
        if (!user) return;

        pushNotification({
            id: `friend-request-${relationship.id}`,
            category: "friend_request",
            title: `${user.globalName || user.username || "Someone"} sent you a friend request`,
            content: "",
            guildName: "",
            channelName: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            author: user,
        });
    } catch (err) {
        console.error("[YouBar+] Inbox friend request error:", err);
    }
}

// Discord's own client already computes this as a distinct event when a relationship transitions
// to FRIEND from PENDING_OUTGOING - confirmed against the decompiled bundle, dispatched right
// alongside RELATIONSHIP_ADD's own handling rather than something this plugin has to derive itself.
function handleFriendRequestAccepted(payload: any) {
    try {
        const user = payload?.user;
        if (!user) return;

        pushNotification({
            id: `friend-accepted-${user.id}-${Date.now()}`,
            category: "friend_request",
            title: `${user.globalName || user.username || "Someone"} accepted your friend request`,
            content: "",
            guildName: "",
            channelName: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            author: user,
        });
    } catch (err) {
        console.error("[YouBar+] Inbox friend accept error:", err);
    }
}

function handleThreadMembersUpdate(payload: any) {
    try {
        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser) return;

        const addedMembers = payload?.addedMembers;
        if (!Array.isArray(addedMembers)) return;
        if (!addedMembers.some((m: any) => m?.userId === currentUser.id)) return;

        const threadId = payload.id;
        const thread = ChannelStore?.getChannel?.(threadId);
        if (!thread) return;

        const guildId = payload.guildId ?? thread.guild_id;
        const guild = guildId ? GuildStore?.getGuild?.(guildId) : undefined;

        pushNotification({
            id: `thread-added-${threadId}`,
            category: "thread",
            title: `You were added to a thread`,
            content: thread.name ? `#${thread.name}` : "",
            guildName: guild?.name || "",
            channelName: thread.name ? `#${thread.name}` : "",
            guildId,
            channelId: threadId,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
    } catch (err) {
        console.error("[YouBar+] Inbox thread-added error:", err);
    }
}

// Friends only, no bots - a status update from a random server member or a bot's "Playing" state
// isn't the kind of thing worth an inbox entry for.
function handlePresenceUpdate(payload: any) {
    try {
        const userId = payload?.user?.id ?? payload?.userId;
        if (!userId) return;

        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser || userId === currentUser.id) return;

        const friendIds: string[] = RelationshipStore?.getFriendIDs?.() ?? [];
        if (!friendIds.includes(userId)) return;

        const user = UserStore?.getUser?.(userId);
        if (user?.bot) return;

        const activities = payload?.activities;
        const activity = Array.isArray(activities) ? activities.find((a: any) => a?.type !== 4) : undefined;

        const signature = activity ? `${activity.type}:${activity.name}` : "";
        if (lastActivitySignature.get(userId) === signature) return;
        lastActivitySignature.set(userId, signature);

        if (!activity) return; // cleared their activity - nothing to notify about

        const verb = ACTIVITY_VERBS[activity.type] ?? "Playing";
        const displayName = user?.globalName || user?.username || payload?.user?.globalName || payload?.user?.username || "A friend";

        pushNotification({
            id: `presence-${userId}-${Date.now()}`,
            category: "other",
            title: `${displayName} started ${verb} ${activity.name}`,
            content: "",
            guildName: "",
            channelName: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            author: user ?? payload?.user,
        });
    } catch (err) {
        console.error("[YouBar+] Inbox presence error:", err);
    }
}

export function startTrackingNotifications(): () => void {
    memoryNotifications = Array.isArray(storage.notifications) ? [...storage.notifications] : [];

    const unsubMessage = fluxSubscribe("MESSAGE_CREATE", handleIncomingMessage);
    const unsubReaction = fluxSubscribe("MESSAGE_REACTION_ADD", handleReactionAdd);
    const unsubRelationship = fluxSubscribe("RELATIONSHIP_ADD", handleRelationshipAdd);
    const unsubFriendAccepted = fluxSubscribe("FRIEND_REQUEST_ACCEPTED", handleFriendRequestAccepted);
    const unsubThreadMembers = fluxSubscribe("THREAD_MEMBERS_UPDATE", handleThreadMembersUpdate);
    const unsubPresence = fluxSubscribe("PRESENCE_UPDATE", handlePresenceUpdate);

    return () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        storage.notifications = memoryNotifications.slice(0, 100);
        unsubMessage();
        unsubReaction();
        unsubRelationship();
        unsubFriendAccepted();
        unsubThreadMembers();
        unsubPresence();
        lastActivitySignature.clear();
    };
}
