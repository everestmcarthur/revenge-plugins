import React from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { lazy } from "../lib/lazy";
import { rawFindByProps } from "../lib/rawFind";
import { GuildNode } from "../utils/theme";
import GuildIcon from "./GuildIcon";
import { ContextMenuModal, ContextMenuItem } from "./ContextMenuModal";

const ICON = 48;

const Flux = findByProps("useStateFromStores");
const GuildReadStateStore = findByStoreName("GuildReadStateStore");
const GuildStore = findByStoreName("GuildStore");
const GuildChannelStore = findByStoreName("GuildChannelStore");
const ChannelStore = findByStoreName("ChannelStore");
const Haptic = findByProps("triggerHapticFeedback", "HapticFeedbackTypes");

// rawFindByProps, not findByProps, because these are retried via lazy() - see rawFind.ts for why
// a retried cached findByProps call is a no-op after its first failure.
const getBulkAck = lazy(() => rawFindByProps("bulkAck", "ackChannel"));
const getReadStateTypes = lazy(() => rawFindByProps("ReadStateTypes", "UnreadSetting")?.ReadStateTypes);

// Discord's own per-guild context menu (getGuildsBarGuildMenuItems) is a bare default export with
// no named export - findByName/`.default.name` heuristics for it are unreliable, since a plain
// function's own .name doesn't survive production minification the way an explicit .displayName
// assignment does (confirmed by cross-checking: many memo-wrapped components' .displayName DID
// show up as literal strings in decompiled source, this function's .name never does). Rather than
// guess at a fragile lookup, this builds a small menu from actions this repo has already confirmed
// work elsewhere (the same bulkAck path MarkAllReadButton uses, scoped to one guild).
function markGuildRead(guildId: string) {
    const bulkAck = getBulkAck();
    const ReadStateTypes = getReadStateTypes();
    if (!bulkAck?.bulkAck || ReadStateTypes?.CHANNEL == null || !GuildChannelStore?.getSelectableChannelIds) {
        showToast("Couldn't find Discord's read-state action - this may be unavailable on your version.", undefined);
        return;
    }

    const channelIds = [
        ...(GuildChannelStore.getSelectableChannelIds(guildId) ?? []),
        ...(GuildChannelStore.getVocalChannelIds?.(guildId) ?? []),
    ];
    const channels = channelIds.map((channelId: string) => ({
        channelId,
        readStateType: ReadStateTypes.CHANNEL,
        messageId: ChannelStore?.getChannel?.(channelId)?.lastMessageId ?? null,
    }));

    if (channels.length === 0) {
        showToast("Nothing to mark as read.", undefined);
        return;
    }

    bulkAck.bulkAck(channels);
    showToast("Marked as read", undefined);
}

function Badge({ guildId }: { guildId: string }) {
    useProxy(storage);

    const mentionCount = Flux?.useStateFromStores?.(
        [GuildReadStateStore],
        () => GuildReadStateStore?.getMentionCount?.(guildId) ?? 0,
        [guildId],
    ) ?? 0;

    const hasUnread = Flux?.useStateFromStores?.(
        [GuildReadStateStore],
        () => GuildReadStateStore?.hasUnread?.(guildId) ?? false,
        [guildId],
    ) ?? false;

    if (!storage.showUnreadBadges) return null;

    if (mentionCount > 0) {
        return (
            <View style={bd.outline}>
                <View style={bd.badge}>
                    <Text style={bd.text}>{mentionCount > 99 ? "99+" : String(mentionCount)}</Text>
                </View>
            </View>
        );
    }

    if (hasUnread) {
        return (
            <View style={bd.dotOutline}>
                <View style={bd.dot} />
            </View>
        );
    }

    return null;
}

export default function GuildItem({ node, onPick }: { node: GuildNode; onPick: (id: string) => void }) {
    const viewRef = React.useRef<View>(null);
    const scale = React.useRef(new Animated.Value(1)).current;
    const scaleDown = () => Animated.spring(scale, { toValue: 0.85, useNativeDriver: true }).start();
    const scaleUp = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    const [menuState, setMenuState] = React.useState<{
        visible: boolean;
        items: ContextMenuItem[];
        title: string;
        x: number;
        y: number;
    }>({ visible: false, items: [], title: "", x: 0, y: 0 });

    const showMenu = React.useCallback(() => {
        const guildId = node.id as string;
        const guild = GuildStore?.getGuild?.(guildId);
        if (!guild) return;

        const ref = viewRef.current as any;
        if (!ref?.measure) return;

        const items: ContextMenuItem[] = [
            { label: "Mark as Read", action: () => markGuildRead(guildId) },
            {
                label: "Copy Server ID",
                action: () => {
                    clipboard.setString(guildId);
                    showToast("Copied server ID", undefined);
                },
            },
        ];

        ref.measure((_fx: number, _fy: number, _w: number, _h: number, pageX: number, pageY: number) => {
            setMenuState({
                visible: true,
                items,
                title: guild.name,
                x: pageX,
                y: pageY,
            });
        });
    }, [node.id]);

    const handleLongPress = React.useCallback(() => {
        Haptic?.triggerHapticFeedback?.(Haptic.HapticFeedbackTypes.IMPACT_MEDIUM);
        showMenu();
    }, [showMenu]);

    const guildId = node.id as string;

    return (
        <>
            <Pressable
                onPressIn={scaleDown}
                onPressOut={scaleUp}
                onPress={() => onPick(guildId)}
                onLongPress={handleLongPress}
                delayLongPress={500}
            >
                <View ref={viewRef} style={st.outer} collapsable={false}>
                    <Animated.View style={[st.icon, { transform: [{ scale }] }]}>
                        <GuildIcon id={guildId} />
                    </Animated.View>
                    <Badge guildId={guildId} />
                </View>
            </Pressable>
            <ContextMenuModal
                visible={menuState.visible}
                items={menuState.items}
                title={menuState.title}
                anchorX={menuState.x}
                anchorY={menuState.y}
                onClose={() => setMenuState((s) => ({ ...s, visible: false }))}
            />
        </>
    );
}

const st = StyleSheet.create({
    outer: { width: ICON, height: ICON },
    icon: { width: ICON, height: ICON, borderRadius: 16, overflow: "hidden" },
});

const bd = StyleSheet.create({
    outline: {
        position: "absolute",
        bottom: -3,
        right: -3,
        minWidth: 23,
        minHeight: 23,
        borderRadius: 12,
        backgroundColor: "#1a1a2e",
        alignItems: "center",
        justifyContent: "center",
    },
    badge: {
        minWidth: 19,
        height: 19,
        borderRadius: 9,
        backgroundColor: "#ed4245",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 5,
    },
    text: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
        lineHeight: 19,
    },
    dotOutline: {
        position: "absolute",
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#1a1a2e",
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#ed4245",
    },
});
