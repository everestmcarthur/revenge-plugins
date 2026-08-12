import { findByStoreName } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Module, ModuleCategory } from "../../lib/Module";
import { registerMessageAction, type MessageActionRow } from "../../lib/messageActionSheet";
import { decodeSnowflakeTimestamp } from "../../lib/snowflake";

const GuildStore = findByStoreName("GuildStore");
const RelationshipStore = findByStoreName("RelationshipStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const UserStore = findByStoreName("UserStore");

const COPY_ICON = "ic_copy_24px";

function copy(value: string, toastLabel: string) {
    clipboard.setString(value);
    showToast(toastLabel, getAssetIDByName(COPY_ICON));
}

function getGuildId(message: any): string | null {
    return message?.guildId ?? message?.guild_id ?? null;
}

function serverInfoRow(message: any): MessageActionRow[] {
    const guildId = getGuildId(message);
    if (!guildId || !GuildStore?.getGuild) return [];

    const guild = GuildStore.getGuild(guildId);
    if (!guild) return [];

    return [
        {
            key: "rose-utils-copy-server-info",
            label: "Copy Server Info",
            sublabel: guild.name,
            icon: COPY_ICON,
            onPress: () => {
                const info = {
                    id: guildId,
                    name: guild.name,
                    ownerId: guild.ownerId,
                    createdAt: decodeSnowflakeTimestamp(guildId)?.toISOString(),
                    boostTier: guild.premiumTier,
                    boostCount: guild.premiumSubscriberCount,
                    verificationLevel: guild.verificationLevel,
                    vanityURLCode: guild.vanityURLCode,
                    description: guild.description,
                    features: guild.features,
                };
                copy(JSON.stringify(info, null, 2), "Copied server info to clipboard");
            },
        },
    ];
}

function friendsInServerRow(message: any): MessageActionRow[] {
    const guildId = getGuildId(message);
    if (!guildId || !RelationshipStore?.getFriendIDs || !GuildMemberStore?.getMember) return [];

    let friendIds: string[];
    try {
        friendIds = RelationshipStore.getFriendIDs();
    } catch {
        return [];
    }
    if (!Array.isArray(friendIds) || !friendIds.length) return [];

    return [
        {
            key: "rose-utils-copy-friends-in-server",
            label: "Copy Friends In This Server",
            sublabel: "Only counts friends already loaded into this server's member list this session",
            icon: COPY_ICON,
            onPress: () => {
                const inServer = friendIds
                    .filter((id) => {
                        try {
                            return !!GuildMemberStore.getMember(guildId, id);
                        } catch {
                            return false;
                        }
                    })
                    .map((id) => UserStore?.getUser?.(id)?.username ?? id);

                copy(
                    inServer.length
                        ? inServer.join(", ")
                        : "(none found - they may just not be loaded into the member list yet)",
                    `Copied ${inServer.length} friend${inServer.length === 1 ? "" : "s"} in this server to clipboard`,
                );
            },
        },
    ];
}

export default new Module({
    id: "server-info-tools",
    label: "Server Info Tools",
    meta: {
        sublabel: "Adds Copy Server Info and Copy Friends In This Server rows to the message long-press menu",
        category: ModuleCategory.Useful,
    },
    settings: {
        copyServerInfo: {
            label: "Copy Server Info",
            subLabel: "Boost tier, verification level, features, vanity URL, creation date, and more",
            type: "toggle",
            default: true,
        },
        copyFriendsInServer: {
            label: "Copy Friends In This Server",
            subLabel: "Cross-references your friends list against this server's cached member list",
            type: "toggle",
            default: true,
        },
    },
    handlers: {
        onStart() {
            const options = this.storage.options;
            if (options.copyServerInfo) this.patches.add(registerMessageAction(serverInfoRow));
            if (options.copyFriendsInServer) this.patches.add(registerMessageAction(friendsInServerRow));
        },
        onStop() {},
    },
});
