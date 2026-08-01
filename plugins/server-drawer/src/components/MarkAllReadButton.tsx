import React from "react";
import { Pressable, Image, StyleSheet } from "react-native";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { lazy } from "@shared/lib/lazy";

const ICON = 48;

const CheckIcon = getAssetIDByName("CheckmarkLargeIcon");
const GuildStore = findByStoreName("GuildStore");
const GuildChannelStore = findByStoreName("GuildChannelStore");

// Lazy because bulkAck lives on an action-creator module that, like routing, may not be required
// by Discord's own code yet at the moment this plugin's bundle loads.
const getHaptic = lazy(() => findByProps("triggerHapticFeedback", "HapticFeedbackTypes"));
const getBulkAck = lazy(() => findByProps("bulkAck", "ackChannel"));
const getReadStateTypes = lazy(() => findByProps("ReadStateTypes", "UnreadSetting")?.ReadStateTypes);

// Mirrors the payload shape Discord's own bulk-ack call sites use (confirmed against decompiled
// current-build source, e.g. modules/guild/markGuildsAsRead.tsx): an array of
// { channelId, readStateType, messageId } acked in one dispatch. Built here from GuildStore +
// GuildChannelStore directly rather than calling markGuildsAsRead itself, since that module has no
// named export to reliably target with findByProps (it's a bare default export).
function markAllServersRead() {
    const bulkAck = getBulkAck();
    const ReadStateTypes = getReadStateTypes();
    if (!bulkAck?.bulkAck || ReadStateTypes?.CHANNEL == null || !GuildStore?.getGuilds || !GuildChannelStore?.getChannels) {
        showToast("Couldn't find Discord's read-state action - this may be unavailable on your version.", undefined);
        return;
    }

    const channels: { channelId: string; readStateType: number; messageId: string | null }[] = [];

    for (const guildId of Object.keys(GuildStore.getGuilds())) {
        const byType = GuildChannelStore.getChannels(guildId) ?? {};
        for (const entries of Object.values(byType)) {
            if (!Array.isArray(entries)) continue;
            for (const entry of entries as any[]) {
                const channel = entry?.channel;
                if (!channel?.id) continue;
                channels.push({
                    channelId: channel.id,
                    readStateType: ReadStateTypes.CHANNEL,
                    messageId: channel.lastMessageId ?? null,
                });
            }
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
