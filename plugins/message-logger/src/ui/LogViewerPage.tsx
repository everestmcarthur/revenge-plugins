import { findByName, findByProps } from "@vendetta/metro";
import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { TextInput } from "@shared/ui/table";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { getLog, removeLogEntry } from "../lib/store";
import type { LoggedMessage } from "../lib/types";

// Same Navigation/Navigator/close-button lookup as this repo's ViewRaw plugin.
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
    findByProps("getRenderCloseButton")?.getRenderCloseButton ??
    findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;

const { View, Text, ScrollView, TouchableOpacity } = ReactNative;

const PAGE_SIZE = 100;

function textColor(): string {
    return resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");
}

function formatTime(value: number | string | undefined): string {
    if (!value) return "unknown time";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return String(value);
    }
}

function kindLabel(kind: LoggedMessage["kind"]): string {
    if (kind === "deleted") return "🗑 Deleted";
    if (kind === "bulk-deleted") return "🗑 Bulk deleted";
    return "✎ Edited";
}

function entryMatches(entry: LoggedMessage, query: string): boolean {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
        entry.content?.toLowerCase().includes(needle) ||
        entry.newContent?.toLowerCase().includes(needle) ||
        entry.authorUsername?.toLowerCase().includes(needle) ||
        entry.authorDisplayName?.toLowerCase().includes(needle) ||
        entry.channelId?.includes(needle) ||
        entry.guildId?.includes(needle) ||
        entry.authorId?.includes(needle) ||
        false
    );
}

function EntryDetail({ entry, onClose, onDeleted }: { entry: LoggedMessage; onClose: () => void; onDeleted: () => void }) {
    const color = textColor();

    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, color }}>
                {kindLabel(entry.kind)} · {formatTime(entry.timestamp)} · logged {formatTime(entry.loggedAt)}
                {entry.keptInline ? " · kept in chat" : ""}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "700", marginBottom: 8, color }}>
                {entry.authorDisplayName || entry.authorUsername || entry.authorId || "Unknown author"}
            </Text>

            {entry.kind === "edited" ? (
                <>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2, color }}>Before:</Text>
                    <Text style={{ fontSize: 14, marginBottom: 10, color }} selectable>{entry.content || "(empty)"}</Text>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2, color }}>After:</Text>
                    <Text style={{ fontSize: 14, marginBottom: 10, color }} selectable>{entry.newContent || "(empty)"}</Text>
                </>
            ) : (
                <Text style={{ fontSize: 14, marginBottom: 10, color }} selectable>{entry.content || "(empty)"}</Text>
            )}

            {entry.attachments.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2, color }}>
                        Attachments ({entry.attachments.length}):
                    </Text>
                    {entry.attachments.map((a, i) => (
                        <Text key={i} style={{ fontSize: 13, color }} selectable>
                            {a.filename}{a.url ? ` - ${a.url}` : ""}
                        </Text>
                    ))}
                </View>
            )}

            {entry.embeds.length > 0 && (
                <Text style={{ fontSize: 13, marginBottom: 10, color }}>
                    {entry.embeds.length} embed{entry.embeds.length === 1 ? "" : "s"}
                </Text>
            )}
            {entry.components.length > 0 && (
                <Text style={{ fontSize: 13, marginBottom: 10, color }}>
                    {entry.components.length} component{entry.components.length === 1 ? "" : "s"} (Components V2)
                </Text>
            )}
            {entry.stickerItems.length > 0 && (
                <Text style={{ fontSize: 13, marginBottom: 10, color }}>
                    {entry.stickerItems.length} sticker{entry.stickerItems.length === 1 ? "" : "s"}
                </Text>
            )}
            {entry.poll && (
                <Text style={{ fontSize: 13, marginBottom: 10, color }}>Included a poll</Text>
            )}

            <Text style={{ fontSize: 11, opacity: 0.5, marginBottom: 16, color }} selectable>
                Message ID: {entry.id}{"\n"}Channel ID: {entry.channelId}{entry.guildId ? `\nServer ID: ${entry.guildId}` : ""}
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                    onPress={() => {
                        clipboard.setString(JSON.stringify(entry, null, 2));
                        showToast("Copied entry as JSON", getAssetIDByName("ic_copy_24px"));
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color }}>Copy JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        removeLogEntry(entry.loggedAt);
                        showToast("Removed entry", undefined);
                        onDeleted();
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#F23F42" }}>Delete entry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color }}>Back</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function LogList() {
    const [query, setQuery] = React.useState("");
    const [kindFilter, setKindFilter] = React.useState<"all" | "deleted" | "edited">("all");
    const [selected, setSelected] = React.useState<LoggedMessage | null>(null);
    const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
    const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0);
    const color = textColor();

    const all = getLog();
    const filtered = React.useMemo(() => {
        return all
            .filter((e) => (kindFilter === "all" ? true : kindFilter === "deleted" ? e.kind !== "edited" : e.kind === "edited"))
            .filter((e) => entryMatches(e, query.trim()))
            .slice()
            .reverse();
    }, [all.length, query, kindFilter]);

    if (selected) {
        return (
            <EntryDetail
                entry={selected}
                onClose={() => setSelected(null)}
                onDeleted={() => {
                    setSelected(null);
                    forceUpdate();
                }}
            />
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={{ padding: 16 }}>
                <TextInput
                    label="Search"
                    placeholder="Search content, author, channel/server/user ID..."
                    value={query}
                    onChange={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                    {(["all", "deleted", "edited"] as const).map((k) => (
                        <TouchableOpacity key={k} onPress={() => setKindFilter(k)}>
                            <Text style={{ fontSize: 13, fontWeight: kindFilter === k ? "700" : "400", opacity: kindFilter === k ? 1 : 0.6, color }}>
                                {k === "all" ? "All" : k === "deleted" ? "Deleted" : "Edited"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={{ fontSize: 12, opacity: 0.5, marginTop: 8, color }}>
                    {filtered.length} of {all.length} total
                </Text>
            </View>

            <ScrollView style={{ flex: 1 }}>
                {filtered.slice(0, visibleCount).map((entry) => (
                    <TouchableOpacity
                        key={entry.loggedAt}
                        onPress={() => setSelected(entry)}
                        style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(128,128,128,0.15)" }}
                    >
                        <Text style={{ fontSize: 12, opacity: 0.6, color }}>
                            {kindLabel(entry.kind)} · {entry.authorDisplayName || entry.authorUsername || entry.authorId || "Unknown"} · {formatTime(entry.timestamp)}
                        </Text>
                        <Text numberOfLines={2} style={{ fontSize: 14, color }}>
                            {(entry.kind === "edited" ? entry.newContent : entry.content) || "(no text content)"}
                        </Text>
                    </TouchableOpacity>
                ))}
                {filtered.length === 0 && (
                    <Text style={{ padding: 16, opacity: 0.6, color }}>No log entries match.</Text>
                )}
                {visibleCount < filtered.length && (
                    <TouchableOpacity onPress={() => setVisibleCount((n) => n + PAGE_SIZE)} style={{ padding: 16, alignItems: "center" }}>
                        <Text style={{ fontWeight: "600", color }}>Load more ({filtered.length - visibleCount} remaining)</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

export default function openLogViewer(): void {
    if (!Navigator || !Navigation) {
        showToast("Couldn't open the log viewer - Navigator not found", undefined);
        return;
    }

    Navigation.push(() => (
        <Navigator
            initialRouteName="MessageLoggerViewer"
            goBackOnBackPress
            screens={{
                MessageLoggerViewer: {
                    title: "Message Log",
                    headerLeft: modalCloseButton?.(() => Navigation.pop()),
                    render: () => <LogList />,
                },
            }}
        />
    ));
}
