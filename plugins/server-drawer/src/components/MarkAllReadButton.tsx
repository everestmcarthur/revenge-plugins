import React from "react";
import { Pressable, Image, StyleSheet } from "react-native";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { lazy } from "../lib/lazy";
import { rawFindByStoreName } from "../lib/rawFind";
import { getHaptic, getBulkAckMod, getReadStateTypesMod } from "../lib/commonModules";

const ICON = 48;

const CheckIcon = getAssetIDByName("CheckmarkLargeIcon");

// getHaptic/getBulkAckMod/getReadStateTypesMod come from lib/commonModules.ts - see that file for
// the decoy-module writeup.
const getBulkAck = getBulkAckMod;
const getReadStateTypes = lazy(() => getReadStateTypesMod()?.ReadStateTypes);

// These three switch from an eager, module-load-time findByStoreName (the caching finder,
// permanently wrong if it runs before the store module has registered) to lazy + rawFindByStoreName
// for the same reason established earlier this session, not the decoy-module issue above -
// unverified whether the decoy fakes a getName() zero-arg store-name match too.
const getSortedGuildStore = lazy(() => rawFindByStoreName("SortedGuildStore"));
const getGuildChannelStore = lazy(() => rawFindByStoreName("GuildChannelStore"));
const getChannelStore = lazy(() => rawFindByStoreName("ChannelStore"));

function collectGuildIds(): string[] {
    // Same tree ServerDrawerSheet already renders from (SortedGuildStore.getGuildsTree()), so this
    // reaches every guild the drawer shows, folders included, using data already proven to resolve
    // correctly rather than a separately-shaped GuildStore method.
    const tree = getSortedGuildStore()?.getGuildsTree?.();
    const roots = (tree?.root?.children ?? []).filter((n: any) => n?.type !== "root");

    const ids: string[] = [];
    const visit = (nodes: any[]) => {
        for (const node of nodes) {
            if (node.type === "folder") visit(node.children ?? []);
            else if (node.id != null) ids.push(String(node.id));
        }
    };
    visit(roots);
    return ids;
}

// Mirrors exactly what Discord's own modules/guild/markGuildsAsRead.tsx does (confirmed against
// decompiled current-build source): flatMap getSelectableChannelIds(guild) + getVocalChannelIds
// (guild), then bulkAck an array of { channelId, readStateType, messageId }. Built here directly
// rather than calling markGuildsAsRead itself, since that module has no named export to reliably
// target with findByProps (it's a bare default export with nothing else on the module to key off).
function markAllServersRead() {
    const bulkAck = getBulkAck();
    const ReadStateTypes = getReadStateTypes();
    const GuildChannelStore = getGuildChannelStore();
    const ChannelStore = getChannelStore();
    if (
        !bulkAck?.bulkAck || ReadStateTypes?.CHANNEL == null ||
        !GuildChannelStore?.getSelectableChannelIds || !GuildChannelStore?.getVocalChannelIds
    ) {
        showToast("Couldn't find Discord's read-state action - this may be unavailable on your version.", undefined);
        return;
    }

    const guildIds = collectGuildIds();
    if (guildIds.length === 0) {
        showToast("Nothing to mark as read.", undefined);
        return;
    }

    const channels: { channelId: string; readStateType: number; messageId: string | null }[] = [];

    for (const guildId of guildIds) {
        const channelIds = [
            ...(GuildChannelStore.getSelectableChannelIds(guildId) ?? []),
            ...(GuildChannelStore.getVocalChannelIds(guildId) ?? []),
        ];
        for (const channelId of channelIds) {
            channels.push({
                channelId,
                readStateType: ReadStateTypes.CHANNEL,
                messageId: ChannelStore?.getChannel?.(channelId)?.lastMessageId ?? null,
            });
        }
    }

    if (channels.length === 0) {
        showToast("Nothing to mark as read.", undefined);
        return;
    }

    bulkAck.bulkAck(channels);
    showToast(`Marked ${channels.length} channel${channels.length === 1 ? "" : "s"} as read`, undefined);
}

export default function MarkAllReadButton() {
    const onPress = React.useCallback(() => {
        const haptic = getHaptic();
        haptic?.triggerHapticFeedback?.(haptic.HapticFeedbackTypes.SOFT);
        markAllServersRead();
    }, []);

    return (
        <Pressable onPress={onPress} style={st.outer}>
            <Image source={CheckIcon} style={{ width: 24, height: 24, tintColor: "#80848e" }} />
        </Pressable>
    );
}

const st = StyleSheet.create({
    outer: { width: ICON, height: ICON, alignItems: "center", justifyContent: "center" },
});
