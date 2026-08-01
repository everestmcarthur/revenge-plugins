import React from "react";
import { Pressable, Image, StyleSheet } from "react-native";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { lazy } from "@shared/lib/lazy";

const ICON = 48;

const CheckIcon = getAssetIDByName("CheckmarkLargeIcon");
const SortedGuildStore = findByStoreName("SortedGuildStore");
const GuildChannelStore = findByStoreName("GuildChannelStore");
const ChannelStore = findByStoreName("ChannelStore");

// Lazy because bulkAck lives on an action-creator module that, like routing, may not be required
// by Discord's own code yet at the moment this plugin's bundle loads.
const getHaptic = lazy(() => findByProps("triggerHapticFeedback", "HapticFeedbackTypes"));
const getBulkAck = lazy(() => findByProps("bulkAck", "ackChannel"));
const getReadStateTypes = lazy(() => findByProps("ReadStateTypes", "UnreadSetting")?.ReadStateTypes);

function collectGuildIds(): string[] {
    // Same tree ServerDrawerSheet already renders from (SortedGuildStore.getGuildsTree()), so this
    // reaches every guild the drawer shows, folders included, using data already proven to resolve
    // correctly rather than a separately-shaped GuildStore method.
    const tree = SortedGuildStore?.getGuildsTree?.();
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
