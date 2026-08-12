import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { shouldIgnore } from "../lib/filters";
import { snapshotMessage } from "../lib/capture";
import { addLogEntry } from "../lib/store";
import type { FilterOptions } from "../lib/types";

const TAG = "[MessageLogger]";
const FAKE_DELETE_FLAG = "__msgLoggerDeleted";
const CLEANUP_FLAG = "__msgLoggerCleanup";

const ChannelMessages = findByProps("_channelMessages");
const UserStore = findByStoreName("UserStore");

// Ids currently kept "alive" as a faked MESSAGE_UPDATE instead of a real delete, mapped to the
// channel they belong to - tracked so onUnload can put them back the way it found them (dispatch a
// real delete for each) rather than leaving the client's own message cache holding fake state
// forever if the plugin gets disabled.
export const fakedMessages = new Map<string, string>();

// Every past content version for a message, oldest first, current content NOT included (rowStyling
// appends that itself from the live record). Same id-in-external-map pattern as fakedMessages -
// row.message.id survives into the row JSON, a custom property doesn't (confirmed live).
export const editHistory = new Map<string, string[]>();

function currentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id;
}

function numberOption(raw: string | undefined, fallback: number): number {
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function limitsFromStorage(): { maxEntries: number; maxAgeDays: number; maxPerChannel: number } {
    return {
        maxEntries: numberOption(storage.options?.maxEntries, 2000),
        maxAgeDays: numberOption(storage.options?.maxAgeDays, 30),
        maxPerChannel: numberOption(storage.options?.maxEntriesPerChannel, 0),
    };
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

function fakeUpdateFor(original: any): any {
    return { type: "MESSAGE_UPDATE", message: { ...original, [FAKE_DELETE_FLAG]: true } };
}

function captureAndMaybeKeep(original: any, channelId: string, id: string): any | undefined {
    const EPHEMERAL = 64;
    if (!original?.author?.id) return undefined; // never cached, or already evicted - nothing left to do
    if ((original.flags & EPHEMERAL) === EPHEMERAL) return undefined; // an ephemeral dismiss, not a real delete
    if (!hasLoggableContent(original)) return undefined;
    if (!storage.options?.logDeleted) return undefined;
    if (ignoredFor(original, false)) return undefined;

    const keepInline = !!storage.options?.keepDeletedInline;
    addLogEntry(snapshotMessage(original, "deleted", undefined, keepInline), limitsFromStorage());

    if (!keepInline) return undefined;

    fakedMessages.set(id, channelId);
    return fakeUpdateFor(original);
}

function handleSingleDelete(event: any): any {
    if (event[CLEANUP_FLAG]) return undefined; // our own revert dispatch on unload - pass through untouched

    const channelId = event.channelId ?? event.channel_id;
    const original = ChannelMessages?.get?.(channelId)?.get?.(event.id);
    const fake = captureAndMaybeKeep(original, channelId, event.id);
    return fake ? [fake] : undefined;
}

function handleBulkDelete(event: any): any {
    const channelId = event.channelId ?? event.channel_id;
    const ids: string[] = Array.isArray(event.ids) ? event.ids : [];
    if (!ids.length) return undefined;

    const kept: string[] = [];
    const dropped: string[] = [];

    for (const id of ids) {
        const original = ChannelMessages?.get?.(channelId)?.get?.(id);
        const fake = captureAndMaybeKeep(original, channelId, id);
        if (fake) kept.push(id);
        else dropped.push(id);
    }

    if (!kept.length) return undefined; // nothing kept inline - let the real bulk delete proceed as-is

    // Dispatching more actions from inside a dispatch-in-progress is a real re-entrancy risk (Flux
    // implementations commonly disallow it) - deferred to a microtask, one dispatch per kept message,
    // running after this bulk-delete's own dispatch has fully finished.
    queueMicrotask(() => {
        for (const id of kept) {
            const original = ChannelMessages?.get?.(channelId)?.get?.(id);
            if (!original) continue;
            try {
                FluxDispatcher.dispatch(fakeUpdateFor(original));
            } catch (e: any) {
                console.error(TAG, "Deferred bulk-keep dispatch failed for", id, e?.message ?? e);
            }
        }
    });

    if (!dropped.length) {
        // Every id in this bulk delete is being kept inline via the deferred dispatches above -
        // replace the original bulk delete with a no-op so none of them get removed for real.
        return [{ type: "MESSAGE_DELETE_BULK", channelId, ids: [] }];
    }
    return [{ type: "MESSAGE_DELETE_BULK", channelId, ids: dropped }];
}

function handleUpdate(event: any): void {
    const updated = event?.message;
    if (!updated?.id) return;
    if (updated[FAKE_DELETE_FLAG]) return; // our own fake-delete-as-update, not a real edit

    const channelId = updated.channel_id ?? updated.channelId;
    const original = ChannelMessages?.get?.(channelId)?.get?.(updated.id);
    if (!original) return;

    const newContent = updated.content ?? original.content;
    if (original.content === newContent) return; // MESSAGE_UPDATE also fires for non-content changes
    if (!storage.options?.logEdited) return;
    if (ignoredFor(original, true)) return;

    const history = editHistory.get(updated.id) ?? [];
    history.push(original.content ?? "");
    editHistory.set(updated.id, history);

    addLogEntry(snapshotMessage(original, "edited", newContent, false), limitsFromStorage());
}

export function patchFluxIntercept(cleanups: (() => void)[]): boolean {
    if (!ChannelMessages) {
        console.warn(TAG, "ChannelMessages module not found, skipping capture");
        return false;
    }

    cleanups.push(
        before("dispatch", FluxDispatcher, (args: any[]) => {
            const event = args[0];
            if (!event?.type) return;

            try {
                switch (event.type) {
                    case "MESSAGE_DELETE":
                        return handleSingleDelete(event);
                    case "MESSAGE_DELETE_BULK":
                        return handleBulkDelete(event);
                    case "MESSAGE_UPDATE":
                        handleUpdate(event);
                        return;
                }
            } catch (e: any) {
                console.error(TAG, "Flux intercept error:", e?.message ?? e);
            }
        }),
    );

    return true;
}

/** Reverts every message currently faked-alive back to a real delete - called on unload. */
export function revertFakedMessages(): void {
    for (const [id, channelId] of fakedMessages) {
        try {
            FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId, id, [CLEANUP_FLAG]: true });
        } catch (e: any) {
            console.error(TAG, "Failed to revert faked message", id, e?.message ?? e);
        }
    }
    fakedMessages.clear();
    editHistory.clear();
}
