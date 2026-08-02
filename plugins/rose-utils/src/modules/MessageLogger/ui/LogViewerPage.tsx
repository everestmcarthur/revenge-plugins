import { findByName, findByProps } from "@vendetta/metro";
import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { getLog, removeLogEntry } from "../lib/store";
import type { LoggedMessage } from "../lib/types";

// Same Navigation/Navigator/close-button lookup pattern already proven working in this repo's
// ViewRaw plugin - reused verbatim rather than re-derived, including its fallback chain (findByName
// misses Navigator on current builds, findByProps("Navigator") is the confirmed-working fallback).
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
    findByProps("getRenderCloseButton")?.getRenderCloseButton ??
    findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;

const { View, Text, ScrollView, TouchableOpacity } = ReactNative;
const { FormInput } = Forms;

const PAGE_SIZE = 100;

function formatTime(iso: string | undefined): string {
    if (!iso) return "unknown time";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
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
    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                {entry.kind.toUpperCase()} · {formatTime(entry.messageTimestamp)} · logged {formatTime(entry.loggedAt)}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
                {entry.authorDisplayName || entry.authorUsername || entry.authorId || "Unknown author"}
                {entry.authorIsBot ? "  [BOT]" : ""}
            </Text>

            {entry.kind === "edited" ? (
                <>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>Before:</Text>
                    <Text style={{ fontSize: 14, marginBottom: 10 }} selectable>{entry.content || "(empty)"}</Text>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>After:</Text>
                    <Text style={{ fontSize: 14, marginBottom: 10 }} selectable>{entry.newContent || "(empty)"}</Text>
                </>
            ) : (
                <Text style={{ fontSize: 14, marginBottom: 10 }} selectable>{entry.content || "(empty)"}</Text>
            )}

            {entry.attachments.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>
                        Attachments ({entry.attachments.length}):
                    </Text>
                    {entry.attachments.map((a, i) => (
                        <Text key={i} style={{ fontSize: 13 }} selectable>
                            {a.filename}{a.url ? ` - ${a.url}` : ""}
                        </Text>
                    ))}
                </View>
            )}

            {entry.embeds.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>
                        Embeds ({entry.embeds.length}):
                    </Text>
                    {entry.embeds.map((e, i) => (
                        <Text key={i} style={{ fontSize: 13 }} selectable>
                            {e.title || e.url || "(untitled embed)"}
                        </Text>
                    ))}
                </View>
            )}

            {entry.reactions.length > 0 && (
                <Text style={{ fontSize: 13, marginBottom: 10 }}>
                    Reactions: {entry.reactions.map((r) => `${r.emoji} x${r.count}`).join("  ")}
                </Text>
            )}

            <Text style={{ fontSize: 11, opacity: 0.5, marginBottom: 16 }} selectable>
                Message ID: {entry.id}{"\n"}Channel ID: {entry.channelId}{entry.guildId ? `\nServer ID: ${entry.guildId}` : ""}
                {entry.referencedMessageId ? `\nReplying to: ${entry.referencedMessageId}` : ""}
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                    onPress={() => {
                        clipboard.setString(JSON.stringify(entry, null, 2));
                        showToast("Copied entry as JSON", getAssetIDByName("ic_copy_24px"));
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600" }}>Copy JSON</Text>
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
                    <Text style={{ fontSize: 14, fontWeight: "600" }}>Back</Text>
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

    const all = getLog();
    const filtered = React.useMemo(() => {
        return all
            .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter))
            .filter((e) => entryMatches(e, query.trim()))
            .slice()
            .reverse(); // newest first
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
                <FormInput
                    title="Search"
                    placeholder="Search content, author, channel/server/user ID..."
                    value={query}
                    onChange={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                    {(["all", "deleted", "edited"] as const).map((k) => (
                        <TouchableOpacity key={k} onPress={() => setKindFilter(k)}>
                            <Text style={{ fontSize: 13, fontWeight: kindFilter === k ? "700" : "400", opacity: kindFilter === k ? 1 : 0.6 }}>
                                {k === "all" ? "All" : k === "deleted" ? "Deleted" : "Edited"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
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
                        <Text style={{ fontSize: 12, opacity: 0.6 }}>
                            {entry.kind === "deleted" ? "🗑" : "✎"} {entry.authorDisplayName || entry.authorUsername || entry.authorId || "Unknown"} · {formatTime(entry.messageTimestamp)}
                        </Text>
                        <Text numberOfLines={2} style={{ fontSize: 14 }}>
                            {(entry.kind === "deleted" ? entry.content : entry.newContent) || "(no text content)"}
                        </Text>
                    </TouchableOpacity>
                ))}
                {filtered.length === 0 && (
                    <Text style={{ padding: 16, opacity: 0.6 }}>No log entries match.</Text>
                )}
                {visibleCount < filtered.length && (
                    <TouchableOpacity onPress={() => setVisibleCount((n) => n + PAGE_SIZE)} style={{ padding: 16, alignItems: "center" }}>
                        <Text style={{ fontWeight: "600" }}>Load more ({filtered.length - visibleCount} remaining)</Text>
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
