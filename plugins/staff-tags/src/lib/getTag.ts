import { findByProps, findByStoreName } from "@vendetta/metro";
import { chroma, constants } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { rawColors } from "@vendetta/ui";
import { isValidHex } from "@shared/lib/color";

const { Permissions } = constants;
const permissionsModule = findByProps("computePermissions", "canEveryoneRole");
const GuildMemberStore = findByStoreName("GuildMemberStore");

export interface TagDefinition {
    id: string;
    defaultText: string;
    defaultColor: string;
    condition?: (guild: any, channel: any, user: any) => boolean;
    permissions?: string[];
}

export const TAG_DEFINITIONS: TagDefinition[] = [
    { id: "webhook", defaultText: "WEBHOOK", defaultColor: "#99AAB5", condition: (_g, _c, user) => !!user?.isNonUserBot?.() },
    { id: "owner", defaultText: "OWNER", defaultColor: "#F0B232", condition: (guild, _c, user) => !!guild && guild.ownerId === user?.id },
    { id: "admin", defaultText: "ADMIN", defaultColor: "#F23F42", permissions: ["ADMINISTRATOR"] },
    { id: "staff", defaultText: "STAFF", defaultColor: "#23A55A", permissions: ["MANAGE_GUILD", "MANAGE_CHANNELS", "MANAGE_ROLES", "MANAGE_WEBHOOKS"] },
    { id: "mod", defaultText: "MOD", defaultColor: "#5865F2", permissions: ["MANAGE_MESSAGES", "KICK_MEMBERS", "BAN_MEMBERS"] },
    { id: "vc_mod", defaultText: "VC Mod", defaultColor: "#1ABC9C", permissions: ["MOVE_MEMBERS", "MUTE_MEMBERS", "DEAFEN_MEMBERS"] },
    { id: "chat_mod", defaultText: "Chat Mod", defaultColor: "#9B59B6", permissions: ["MODERATE_MEMBERS"] }
];

export interface TagOverride {
    enabled?: boolean;
    text?: string;
    useCustomColor?: boolean;
    color?: string;
    useGradient?: boolean;
    gradientColor?: string;
}

export interface ResolvedTag {
    id: string;
    text: string;
    textColor: any;
    backgroundColor: string;
    gradientColor?: string;
    verified: boolean;
}

/** Lazily initializes and returns the per-tag settings object, backed directly by plugin storage. */
export function tagSettings(id: string): TagOverride {
    storage.tags ??= {};
    storage.tags[id] ??= {};
    return storage.tags[id];
}

function resolveBackgroundColor(def: TagDefinition, settings: TagOverride, guild: any, user: any): string {
    if (settings.useCustomColor && isValidHex(settings.color)) {
        return settings.color;
    }

    if (storage.useRoleColor) {
        try {
            const roleColor = GuildMemberStore?.getMember?.(guild?.id, user?.id)?.colorString;
            if (roleColor) return roleColor;
        } catch { /* fall through to default */ }
    }

    return def.defaultColor;
}

export default function getTag(guild: any, channel: any, user: any): ResolvedTag | undefined {
    if (!user) return undefined;

    let permissions: string[] = [];
    if (guild) {
        try {
            const permissionsInt = permissionsModule?.computePermissions?.({
                user,
                context: guild,
                overwrites: channel?.permissionOverwrites
            });

            if (permissionsInt != null) {
                permissions = Object.entries(Permissions)
                    .filter(([, bit]) => permissionsInt & (bit as bigint))
                    .map(([name]) => name);
            }
        } catch { /* no guild permission context available, treat as none */ }
    }

    for (const def of TAG_DEFINITIONS) {
        const settings = tagSettings(def.id);
        if (settings.enabled === false) continue;

        const matchesCondition = !!def.condition?.(guild, channel, user);
        const matchesPermission = !user.bot && !!def.permissions?.some(p => permissions.includes(p));
        if (!matchesCondition && !matchesPermission) continue;

        const backgroundColor = resolveBackgroundColor(def, settings, guild, user);
        const textColor = chroma(backgroundColor).get("lab.l") < 70 ? rawColors.WHITE_500 : rawColors.BLACK_500;

        let gradientColor: string | undefined;
        if (settings.useGradient) {
            gradientColor = isValidHex(settings.gradientColor)
                ? settings.gradientColor
                : chroma(backgroundColor).brighten(1.4).hex();
        }

        return {
            id: def.id,
            text: settings.text?.trim() || def.defaultText,
            textColor,
            backgroundColor,
            gradientColor,
            verified: false
        };
    }

    return undefined;
}
