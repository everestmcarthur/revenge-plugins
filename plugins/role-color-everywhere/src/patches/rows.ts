import { findByStoreName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { waitFor } from "@shared/lib/waitFor";
import { rawFindByName } from "@shared/lib/rawFind";
import { defaultTextColor, interpolateColor } from "../lib/color";

const GuildMemberStore = findByStoreName("GuildMemberStore");
const ChannelStore = findByStoreName("ChannelStore");

function patchComponents(component: any, funcs: any[], args: any[], tree?: any[]): any {
    if (!component) return component;
    tree = tree ? [...tree, component] : [component];

    if (Array.isArray(component.content)) {
        component.content.forEach((sub: any, i: number) => (component.content[i] = patchComponents(sub, funcs, args, tree)));
    } else if (component.items) {
        component.items.forEach((sub: any, i: number) => (component.items[i] = patchComponents(sub, funcs, args, tree)));
    } else if (Array.isArray(component)) {
        component.forEach((sub: any, i: number) => (component[i] = patchComponents(sub, funcs, args, tree)));
    }

    if (component.type) {
        for (const func of funcs) {
            component = func(component, args, tree) || component;
        }
    }

    return component;
}

function handleRow(row: any) {
    const { message } = row;
    if (!message) return;
    if ((!storage.chatInterpolation || storage.chatInterpolation <= 0) && storage.noMention) return;

    const channel = ChannelStore?.getChannel(message.channelId);
    if (!channel?.guild_id) return;

    const mentionPatch = (component: any) => {
        if (component.type !== "mention" || !component.userId) return;

        const member = GuildMemberStore?.getMember(channel.guild_id, component.userId);
        const hexc = member?.colorString;
        if (!hexc) return;

        return {
            ...component,
            roleColor: parseInt(hexc.slice(1), 16),
            color: parseInt(hexc.slice(1), 16),
            colorString: hexc
        };
    };

    const colorPatch = (component: any, [authorId]: any[], tree?: any[]) => {
        const types = tree?.map((c) => c.type);
        if (types?.some((t) => ["mention", "channelMention", "roleMention", "commandMention", "link"].includes(t))) return;
        if (component.type !== "text") return;

        const authorMember = GuildMemberStore?.getMember(message.guildId, authorId);
        if (!authorMember?.colorString) return;

        return {
            content: [component],
            target: "usernameOnClick",
            context: {
                username: 1,
                usernameOnClick: {
                    action: "0",
                    userId: "0",
                    linkColor: ReactNative.processColor(
                        interpolateColor(defaultTextColor() ?? "#ffffff", authorMember.colorString, storage.chatInterpolation / 100)
                    ),
                    messageChannelId: "0"
                },
                medium: true
            },
            type: "link"
        };
    };

    const patches: any[] = [];
    if (storage.chatInterpolation > 0) patches.push(colorPatch);

    if (!storage.noMention) {
        patches.push(mentionPatch);
        message.shouldShowRoleOnName = true;
        if (message.referencedMessage?.message) message.referencedMessage.message.shouldShowRoleOnName = true;
    }

    if (!patches.length) return;

    if (message.content) patchComponents({ content: message.content }, patches, [message.authorId]);
    if (message.embeds) {
        message.embeds.forEach((embed: any) => patchComponents({ content: embed.description }, patches, [message.authorId]));
    }
    if (message.referencedMessage?.message?.content) {
        patchComponents({ content: message.referencedMessage.message.content }, patches, [message.referencedMessage.message.authorId]);
    }
}

// Discord's Android client renders the message list natively - message data is passed across the JS/native
// bridge as JSON, so this is patched at that boundary rather than in a React tree, with a fallback to the
// older `RowManager.generate` path for builds where the native bridge doesn't exist.
export default function patchRows(): () => void {
    const { NativeModules } = ReactNative;
    const DCDChatManager = NativeModules?.DCDChatManager;

    if (DCDChatManager?.updateRows) {
        return before("updateRows", DCDChatManager, (args: any[]) => {
            try {
                const rows = JSON.parse(args[1]);
                for (const row of rows) handleRow(row);
                args[1] = JSON.stringify(rows);
            } catch {
                // Leave args untouched - better to show uncolored rows than break message loading.
            }
        });
    }

    // RowManager used to be looked up eagerly at module-import time with the cached findByName - a
    // plugin's top-level code can run before Discord's own code has required RowManager itself, and
    // Revenge's findByName permanently caches a negative result. Confirmed live via Key Inspector's
    // Eval console: a raw, uncached scan found RowManager.prototype.generate present once the module
    // had actually initialized - waitFor + a raw lookup retries until that happens instead of giving
    // up on the first (possibly premature) miss.
    const patches: (() => void)[] = [];
    const handle = waitFor(
        () => {
            const RowManager = rawFindByName<any>("RowManager");
            return RowManager?.prototype?.generate ? RowManager : undefined;
        },
        (RowManager) => {
            patches.push(after("generate", RowManager.prototype, (_: any, row: any) => {
                try { handleRow(row); } catch { /* skip this row */ }
            }));
        }
    );

    return () => {
        handle.cancel();
        patches.forEach((p) => p());
    };
}
