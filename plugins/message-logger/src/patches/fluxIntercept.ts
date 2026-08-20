import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { shouldIgnore } from "../lib/filters";
import { snapshotMessage } from "../lib/capture";
import { addLogEntry, getLog, logLimitsFromStorage } from "../lib/store";
import type { FilterOptions, LoggedMessage } from "../lib/types";

const TAG = "[MessageLogger]";

// A busy, high-traffic channel (flooding, spam, price-ticker bots editing the same message
// repeatedly) can grow these maps without bound over a long session - capped so memory and the
// per-row content-rebuild in rowStyling.ts stay bounded regardless of channel activity.
const MAX_EDIT_HISTORY_PER_MESSAGE = 10;
const MAX_TRACKED_MESSAGES = 500;

// Reinserting a message is a synchronous store write that forces the channel's row list to
// recompute - fine for a handful of messages, but a bot's bulk delete can hand us up to 100 ids in
// one event, and doing that many synchronous reinsertions back to back froze the app for many
// seconds. Past this many ids in a single bulk delete, everything still gets logged, just not
// visually kept inline.
const MAX_INLINE_BULK_KEEP = 5;

// Ids currently kept "alive" inline instead of a real delete, mapped to their channel - tracked so
// onUnload can remove each for real on unload, and so rowStyling.ts knows which rows to style.
export const fakedMessages = new Map<string, string>();

// Past content versions per message, oldest first, current content not included.
export const editHistory = new Map<string, string[]>();

// Our own last-known copy of each message we've seen, keyed by id. Populated on MESSAGE_CREATE and
// refreshed on MESSAGE_UPDATE - this is what lets deletes/edits be logged (and, when enabled,
// reinserted) from a cheap, per-type FluxDispatcher.subscribe() listener instead of a global
// before("dispatch", ...) hook, since a subscriber only ever sees the message *after* MessageStore
// has already applied the mutation (real content/object is gone by then unless we already have our
// own copy of what it used to be).
const shadowMessages = new Map<string, any>();

const UserStore = findByStoreName("UserStore");

// The store's own per-channel message collection - live-verified (via mcp devtools against a real
// client) that ChannelMessages.get(channelId).receiveMessage(msg) returns a new record and
// ChannelMessages.commit(record) writes it back and updates MessageStore.getMessage() results,
// with no FluxDispatcher.dispatch call anywhere in that path. This is what real reinsertion (the
// "keep deleted inline" feature) uses instead of substituting the real delete event.
const ChannelMessages = findByProps("_channelMessages");

function evictOldest<K, V>(map: Map<K, V>, max: number): void {
    while (map.size > max) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === undefined) break;
        map.delete(oldestKey);
    }
}

function currentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id;
}

function filterOptionsFromStorage(): FilterOptions {
    const o = storage.options ?? {};
    return {
        ignoreBots: !!o.ignoreBots,
        ignoreOwnMessages: !!o.ignoreOwnMessages,
        ignoreOwnEdits: !!o.ignoreOwnEdits,
        ignoreDMs: !!o.ignoreDMs,
        ignoredChannelIds: o.ignoredChannelIds ?? "",
        ignoredGuildIds: o.ignoredGuildIds ?? "",
        ignoredUserIds: o.ignoredUserIds ?? "",
        ignoredKeywords: o.ignoredKeywords ?? "",
    };
}

function ignoredFor(message: any, isEdit: boolean): boolean {
    const authorId = message?.author?.id;
    return shouldIgnore(
        {
            channelId: message?.channel_id ?? message?.channelId,
            guildId: message?.guild_id ?? message?.guildId,
            authorId,
            isBot: !!(message?.author?.bot ?? message?.author?.isNonUserBot?.()),
            isOwnMessage: !!authorId && authorId === currentUserId(),
            isEdit,
            content: message?.content ?? "",
        },
        filterOptionsFromStorage(),
    );
}

function hasLoggableContent(message: any): boolean {
    return !!(
        message?.content ||
        message?.attachments?.length ||
        message?.embeds?.length ||
        message?.components?.length ||
        (message?.stickerItems ?? message?.sticker_items)?.length ||
        message?.poll
    );
}

function rememberMessage(message: any): void {
    if (!message?.id) return;
    shadowMessages.set(message.id, message);
    evictOldest(shadowMessages, MAX_TRACKED_MESSAGES);
}

function logDeletion(original: any, keepInline: boolean): void {
    addLogEntry(snapshotMessage(original, "deleted", undefined, keepInline), logLimitsFromStorage());
}

// Writes every given message straight back into the store's own per-channel collection in one
// commit, bypassing Flux entirely - no dispatch call, so no other store (unread counts,
// notifications, etc.) ever learns about it, and only one native row re-render happens per event
// no matter how many messages are being kept inline, instead of one per message.
function reinsertMessages(channelId: string, messages: any[]): string[] {
    const record = ChannelMessages?.get?.(channelId);
    if (!record || !messages.length) return [];
    try {
        let next = record;
        for (const message of messages) next = next.receiveMessage(message);
        ChannelMessages.commit(next);
        return messages.map((m) => m.id);
    } catch (e: any) {
        console.error(TAG, "Failed to reinsert messages", e?.message ?? e);
        return [];
    }
}

// True if this deletion is real (not an ephemeral dismiss) and worth logging/keeping at all.
function eligibleForCapture(original: any): boolean {
    const EPHEMERAL = 64;
    if (!original?.author?.id) return false;
    if ((original.flags & EPHEMERAL) === EPHEMERAL) return false;
    if (!hasLoggableContent(original)) return false;
    if (!storage.options?.logDeleted) return false;
    if (ignoredFor(original, false)) return false;
    return true;
}

// Logs the deletion and, if eligible to be kept inline, returns the original message so the
// caller can batch it into a single reinsertMessages() call - never reinserts by itself.
function processDelete(id: string, allowInline: boolean): any | undefined {
    const original = shadowMessages.get(id);
    shadowMessages.delete(id);
    if (!original) return undefined;
    if (!eligibleForCapture(original)) return undefined;

    const keepInline = allowInline && !!storage.options?.keepDeletedInline;
    logDeletion(original, keepInline);
    return keepInline ? original : undefined;
}

function keepInline(channelId: string, messages: any[]): void {
    const inserted = reinsertMessages(channelId, messages);
    if (!inserted.length) return;
    for (const id of inserted) fakedMessages.set(id, channelId);
    evictOldest(fakedMessages, MAX_TRACKED_MESSAGES);
}

function subscribeSingleDelete(event: any): void {
    const channelId = event.channelId ?? event.channel_id;
    const original = processDelete(event.id, true);
    if (original) keepInline(channelId, [original]);
}

function subscribeBulkDelete(event: any): void {
    const channelId = event.channelId ?? event.channel_id;
    const ids: string[] = Array.isArray(event.ids) ? event.ids : [];
    const allowInline = ids.length <= MAX_INLINE_BULK_KEEP;
    const toKeep: any[] = [];
    for (const id of ids) {
        const original = processDelete(id, allowInline);
        if (original) toKeep.push(original);
    }
    keepInline(channelId, toKeep);
}

function subscribeCreate(event: any): void {
    rememberMessage(event?.message);
}

function subscribeUpdate(event: any): void {
    const updated = event?.message;
    if (!updated?.id) return;

    const original = shadowMessages.get(updated.id);
    rememberMessage(updated);
    if (!original) return;

    const newContent = updated.content ?? original.content;
    if (original.content === newContent) return; // MESSAGE_UPDATE also fires for non-content changes
    if (!storage.options?.logEdited) return;
    if (ignoredFor(original, true)) return;

    const history = editHistory.get(updated.id) ?? [];
    history.push(original.content ?? "");
    if (history.length > MAX_EDIT_HISTORY_PER_MESSAGE) history.shift();
    editHistory.set(updated.id, history);
    evictOldest(editHistory, MAX_TRACKED_MESSAGES);

    addLogEntry(snapshotMessage(original, "edited", newContent, false), logLimitsFromStorage());
}

// Rebuilds editHistory from every "edited" log entry, oldest first per message - the in-memory
// map only ever reflects edits witnessed live, so it's empty again after every restart.
function rebuildEditHistory(): void {
    const byId = new Map<string, LoggedMessage[]>();
    for (const entry of getLog()) {
        if (entry.kind !== "edited") continue;
        const list = byId.get(entry.id) ?? [];
        list.push(entry);
        byId.set(entry.id, list);
    }

    for (const [id, entries] of byId) {
        entries.sort((a, b) => a.loggedAt - b.loggedAt);
        const history = entries.map((e) => e.content ?? "").slice(-MAX_EDIT_HISTORY_PER_MESSAGE);
        editHistory.set(id, history);
    }
    evictOldest(editHistory, MAX_TRACKED_MESSAGES);
}

// Kept-inline deletions are NOT rehydrated here - reinserting a synthetic message only becomes
// visible today by riding along a native row update that's already happening for some other
// reason (confirmed live: writing to ChannelMessages/MessageStore directly, forcing a change
// emit, and dispatching a synthetic MESSAGE_UPDATE for it all failed to surface a test message
// with no real event behind it). Needs its own investigation into injecting a row directly via
// the same before("updateRows", ...) hook rowStyling.ts already uses successfully, rather than
// trying to get Discord's own store to organically pick it up.
export function rehydrateFromLog(): void {
    try {
        rebuildEditHistory();
    } catch (e: any) {
        console.error(TAG, "Failed to rehydrate edit history:", e?.message ?? e);
    }
}

// FluxDispatcher.subscribe() only calls us for the specific action types we ask for, unlike
// before("dispatch", ...) which wraps every single action in the entire app - this plugin never
// patches FluxDispatcher.dispatch at all, regardless of settings.
export function patchFluxIntercept(cleanups: (() => void)[]): boolean {
    if (!ChannelMessages) {
        console.warn(TAG, "ChannelMessages module not found, keep-inline reinsertion will be skipped");
    }

    const subs: [string, (event: any) => void][] = [
        ["MESSAGE_CREATE", subscribeCreate],
        ["MESSAGE_UPDATE", subscribeUpdate],
        ["MESSAGE_DELETE", subscribeSingleDelete],
        ["MESSAGE_DELETE_BULK", subscribeBulkDelete],
    ];

    for (const [type, handler] of subs) {
        FluxDispatcher.subscribe(type, handler);
        cleanups.push(() => FluxDispatcher.unsubscribe(type, handler));
    }

    return true;
}

/** Removes every message currently kept-alive-inline for real - called on unload. */
export function revertFakedMessages(): void {
    for (const [id, channelId] of fakedMessages) {
        const record = ChannelMessages?.get?.(channelId);
        if (!record) continue;
        try {
            ChannelMessages.commit(record.remove(id));
        } catch (e: any) {
            console.error(TAG, "Failed to revert faked message", id, e?.message ?? e);
        }
    }
    fakedMessages.clear();
    editHistory.clear();
    shadowMessages.clear();
}
