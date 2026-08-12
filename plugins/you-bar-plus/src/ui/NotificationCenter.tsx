import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { findByProps, findByDisplayName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { TableRow, TableRowGroup } from "@shared/ui/table";
import { getNotifications } from "../lib/notifications";
import type { MentionSubCategory, NotificationCategory, NotificationItem } from "../lib/types";

// Ported from fshinz/Revenge-Plugins' BetterInbox (credit: shin), merged in here as an optional
// YouBar+ feature - see lib/notifications.ts for why.

const { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } = ReactNative;
const { useState, useMemo, useCallback, memo } = React;

const Router = findByProps("transitionToGuild", "transitionTo");
const NativeTabs = findByDisplayName("Tabs");
const useTabsState = findByProps("useTabsState")?.useTabsState;
const NativeSegmentedControl = findByDisplayName("SegmentedControl");

function getAvatarUrl(author: any): string {
    if (!author) return "https://cdn.discordapp.com/embed/avatars/0.png";
    const { id, avatar, discriminator } = author;

    if (avatar) {
        const ext = typeof avatar === "string" && avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
    }

    try {
        const defaultIndex = discriminator && discriminator !== "0"
            ? parseInt(discriminator, 10) % 5
            : Number((BigInt(id || "0") >> 22n) % 6n);
        return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    } catch {
        return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
}

const NotificationRow = memo(({ item, onPress }: { item: NotificationItem; onPress: () => void }) => {
    const subLabelText = `${item.guildName} · ${item.channelName}\n${item.content || ""}`.trim();

    return (
        <TableRow
            label={item.title}
            subLabel={subLabelText}
            trailing={<Text style={styles.timestampText}>{item.timestamp}</Text>}
            icon={<Image source={{ uri: getAvatarUrl(item.author) }} style={styles.avatarImage} />}
            onPress={onPress}
        />
    );
});

export default function NotificationCenter(): JSX.Element {
    const [activeTabIdx, setActiveTabIdx] = useState(0);
    const [mentionFilterIdx, setMentionFilterIdx] = useState(0);

    const categories: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
    const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

    const currentCategory = categories[activeTabIdx] ?? "mentions";
    const currentMentionFilter = subFilters[mentionFilterIdx] ?? "all";

    const tabsState = useTabsState
        ? useTabsState({
            items: categories.map((cat) => ({ id: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) })),
            initialIndex: 0,
        })
        : null;

    const notifications = getNotifications();

    const displayedNotifications = useMemo(() => {
        const filtered = notifications.filter((n) => {
            if (currentCategory === "mentions") {
                if (n.category !== "mentions") return false;
                if (currentMentionFilter === "all") return true;
                return n.subCategory === currentMentionFilter;
            }
            return n.category === currentCategory;
        });
        return filtered.slice(0, 30);
    }, [notifications, currentCategory, currentMentionFilter]);

    const jumpToMessage = useCallback((guildId?: string, channelId?: string, messageId?: string) => {
        if (!channelId || !messageId) return;
        try {
            if (Router?.transitionToGuild) {
                Router.transitionToGuild(guildId || "@me", channelId, messageId);
            } else if (NavigationNative?.navigate) {
                NavigationNative.navigate("Channel", { guildId, channelId, messageId });
            }
        } catch (err) {
            console.error("[YouBar+] Inbox navigation error:", err);
        }
    }, []);

    return (
        <View style={styles.container}>
            {NativeTabs && tabsState ? (
                <NativeTabs
                    state={{
                        ...tabsState,
                        activeIndex: activeTabIdx,
                        setActiveIndex: (idx: number) => {
                            tabsState.setActiveIndex?.(idx);
                            setActiveTabIdx(idx);
                        },
                    }}
                />
            ) : (
                <View style={styles.tabBar}>
                    {categories.map((tab, idx) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabButton, activeTabIdx === idx && styles.activeTabButton]}
                            onPress={() => setActiveTabIdx(idx)}
                        >
                            <Text style={[styles.tabText, activeTabIdx === idx && styles.activeTabText]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {currentCategory === "mentions" && (
                <View style={styles.subFilterWrapper}>
                    {NativeSegmentedControl ? (
                        <NativeSegmentedControl
                            value={currentMentionFilter}
                            options={subFilters.map((sub) => ({ value: sub, label: sub.toUpperCase() }))}
                            onChange={(val: string) => {
                                const idx = subFilters.indexOf(val as any);
                                if (idx !== -1) setMentionFilterIdx(idx);
                            }}
                            onValueChange={(val: string) => {
                                const idx = subFilters.indexOf(val as any);
                                if (idx !== -1) setMentionFilterIdx(idx);
                            }}
                        />
                    ) : (
                        <View style={styles.subFilterBar}>
                            {subFilters.map((sub, idx) => (
                                <TouchableOpacity
                                    key={sub}
                                    style={[styles.subFilterButton, mentionFilterIdx === idx && styles.activeSubFilter]}
                                    onPress={() => setMentionFilterIdx(idx)}
                                >
                                    <Text style={styles.subFilterText}>{sub.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            <ScrollView style={styles.feed} removeClippedSubviews>
                {displayedNotifications.length === 0 ? (
                    <Text style={styles.emptyText}>No notifications found for this category.</Text>
                ) : (
                    <TableRowGroup title={`RECENT ${currentCategory.toUpperCase()}`}>
                        {displayedNotifications.map((item) => (
                            <NotificationRow
                                key={item.id || `${item.channelId}-${item.messageId}`}
                                item={item}
                                onPress={() => jumpToMessage(item.guildId, item.channelId, item.messageId)}
                            />
                        ))}
                    </TableRowGroup>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    subFilterWrapper: { paddingHorizontal: 12, paddingVertical: 8 },
    tabBar: { flexDirection: "row", paddingVertical: 4 },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
    activeTabButton: { borderBottomWidth: 2, borderBottomColor: "#5865F2" },
    tabText: { color: "#949ba4", fontWeight: "600", fontSize: 13 },
    activeTabText: { color: "#ffffff" },
    subFilterBar: { flexDirection: "row", justifyContent: "center" },
    subFilterButton: { marginHorizontal: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    activeSubFilter: { backgroundColor: "#404249" },
    subFilterText: { color: "#dbdee1", fontSize: 11, fontWeight: "bold" },
    feed: { flex: 1, paddingHorizontal: 8, paddingVertical: 12 },
    emptyText: { color: "#949ba4", textAlign: "center", marginTop: 40, fontSize: 14 },
    avatarImage: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#4e5058" },
    timestampText: { color: "#949ba4", fontSize: 11, alignSelf: "center" },
});
