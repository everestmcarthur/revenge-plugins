import { findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, clipboard } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Module, ModuleCategory } from "../../lib/Module";
import { snapshotMessage } from "./lib/capture";
import { shouldIgnore, type FilterOptions } from "./lib/filters";
import { addLogEntry, clearLog, getLog } from "./lib/store";
import openLogViewer from "./ui/LogViewerPage";

// Same core stores this plugin already relies on elsewhere (GuildStore/UserStore/etc. in
// server-info-tools.ts) - MessageStore is equally fundamental, the client's own cache of every
// message it currently has loaded. The whole capture mechanism depends on reading a message from
// here *before* Discord's own MESSAGE_DELETE/MESSAGE_UPDATE handling removes/overwrites it - which
// is exactly why this patches FluxDispatcher.dispatch itself (the same technique Key Inspector's own
// flux event logger already proved out in this repo) instead of subscribing normally: a normal
// FluxDispatcher.subscribe callback fires in registration order alongside every other listener,
// including MessageStore's own, with no guarantee this one runs first - patching dispatch runs
// before any listener at all, while the store's cache still holds the pre-delete/pre-edit message.
const MessageStore = findByStoreName("MessageStore");
const UserStore = findByStoreName("UserStore");

function currentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id;
}

function numberOption(raw: string | undefined, fallback: number): number {
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function handleDelete(action: any, options: FilterOptions & { notifyOnDelete: boolean }, limits: any) {
    const message = MessageStore?.getMessage?.(action.channelId, action.id);
    if (!message) return; // not cached (never loaded, or already evicted) - nothing left to log

    logIfAllowed(message, "deleted", undefined, options, limits);
}

function handleBulkDelete(action: any, options: FilterOptions & { notifyOnDelete: boolean }, limits: any) {
    const ids: string[] = action?.ids ?? [];
    for (const id of ids) {
        const message = MessageStore?.getMessage?.(action.channelId, id);
        if (message) logIfAllowed(message, "deleted", undefined, options, limits);
    }
}

function handleUpdate(action: any, options: FilterOptions & { notifyOnDelete: boolean }, limits: any) {
    const updated = action?.message;
    if (!updated?.id || (!updated?.channel_id && !updated?.channelId)) return;

    const channelId = updated.channel_id ?? updated.channelId;
    const oldMessage = MessageStore?.getMessage?.(channelId, updated.id);
    if (!oldMessage) return;

    // MESSAGE_UPDATE also fires for things that aren't content edits at all (embeds finishing
    // loading after a link unfurls, pinned state, etc) - only log when the actual text changed.
    const newContent = updated.content ?? oldMessage.content;
    if (oldMessage.content === newContent) return;

    logIfAllowed(oldMessage, "edited", newContent, options, limits);
}

function logIfAllowed(
    message: any,
    kind: "deleted" | "edited",
    newContent: string | undefined,
    options: FilterOptions & { notifyOnDelete: boolean },
    limits: { maxEntries: number; maxAgeDays: number; maxPerChannel: number },
) {
    const authorId = message?.author?.id;
    const guildId = message?.guild_id ?? message?.guildId;

    const ignored = shouldIgnore(
        {
            channelId: message?.channel_id ?? message?.channelId,
            guildId,
            authorId,
            isBot: !!(message?.author?.bot ?? message?.author?.isNonUserBot?.()),
            isOwnMessage: !!authorId && authorId === currentUserId(),
            content: message?.content ?? "",
        },
        options,
    );
    if (ignored) return;

    const entry = snapshotMessage(message, kind, newContent);
    addLogEntry(entry, limits);

    if (options.notifyOnDelete) {
        const who = entry.authorDisplayName || entry.authorUsername || "Someone";
        const preview = (kind === "deleted" ? entry.content : entry.newContent) || "(no text content)";
        showToast(
            `${kind === "deleted" ? "Deleted" : "Edited"}: ${who} - ${preview.slice(0, 60)}`,
            getAssetIDByName("ic_message_edit") ?? undefined,
        );
    }
}

export default new Module({
    id: "message-logger",
    label: "Message Logger",
    meta: {
        sublabel: "Logs deleted and edited messages, persisted on-device across restarts - searchable viewer, ignore lists, and configurable limits",
        category: ModuleCategory.Useful,
    },
    settings: {
        logDeleted: {
            label: "Log deleted messages",
            type: "toggle",
            default: true,
        },
        logEdited: {
            label: "Log edited messages",
            type: "toggle",
            default: true,
        },
        notifyOnDelete: {
            label: "Toast on capture",
            subLabel: "Shows a toast every time something gets logged - can be noisy in busy servers",
            type: "toggle",
            default: false,
        },
        ignoreBots: {
            label: "Ignore bots",
            type: "toggle",
            default: false,
        },
        ignoreOwnMessages: {
            label: "Ignore your own messages",
            type: "toggle",
            default: true,
        },
        ignoreDMs: {
            label: "Ignore DMs",
            type: "toggle",
            default: false,
        },
        onlyLogChannelIds: {
            label: "Only log these channel IDs",
            subLabel: "Comma-separated - if set, every other filter below is ignored and ONLY these channels are logged",
            type: "text",
            default: "",
            placeholder: "e.g. 123456789012345678",
        },
        ignoredChannelIds: {
            label: "Ignored channel IDs",
            type: "text",
            default: "",
            placeholder: "comma-separated",
        },
        ignoredGuildIds: {
            label: "Ignored server IDs",
            type: "text",
            default: "",
            placeholder: "comma-separated",
        },
        ignoredUserIds: {
            label: "Ignored user IDs",
            type: "text",
            default: "",
            placeholder: "comma-separated",
        },
        ignoredKeywords: {
            label: "Ignored keywords",
            subLabel: "Comma-separated - skip logging any message containing one of these (case-insensitive)",
            type: "text",
            default: "",
            placeholder: "e.g. password, secret",
        },
        maxEntries: {
            label: "Max total entries",
            subLabel: "Oldest entries are dropped once this is exceeded - 0 for unlimited",
            type: "text",
            default: "2000",
        },
        maxEntriesPerChannel: {
            label: "Max entries per channel",
            subLabel: "0 for unlimited (only the total cap above applies)",
            type: "text",
            default: "0",
        },
        maxAgeDays: {
            label: "Max age (days)",
            subLabel: "Entries older than this are dropped - 0 for unlimited",
            type: "text",
            default: "30",
        },
        viewLog: {
            label: "View log",
            type: "button",
            action() {
                openLogViewer();
            },
        },
        copyLogAsJson: {
            label: "Copy entire log as JSON",
            type: "button",
            action() {
                const log = getLog();
                clipboard.setString(JSON.stringify(log, null, 2));
                showToast(`Copied ${log.length} log entr${log.length === 1 ? "y" : "ies"} to clipboard`, undefined);
            },
        },
        clearLogButton: {
            label: "Clear entire log",
            subLabel: "This can't be undone",
            type: "button",
            action() {
                const count = getLog().length;
                clearLog();
                showToast(`Cleared ${count} log entr${count === 1 ? "y" : "ies"}`, undefined);
            },
        },
    },
    handlers: {
        onStart() {
            if (!MessageStore) return;

            this.patches.add(
                before("dispatch", FluxDispatcher, (args: any[]) => {
                    const action = args[0];
                    if (!action?.type) return;

                    try {
                        const options = this.storage.options as unknown as FilterOptions & { notifyOnDelete: boolean };
                        const limits = {
                            maxEntries: numberOption(this.storage.options.maxEntries, 2000),
                            maxAgeDays: numberOption(this.storage.options.maxAgeDays, 30),
                            maxPerChannel: numberOption(this.storage.options.maxEntriesPerChannel, 0),
                        };

                        switch (action.type) {
                            case "MESSAGE_DELETE":
                                if (this.storage.options.logDeleted) handleDelete(action, options, limits);
                                break;
                            case "MESSAGE_DELETE_BULK":
                                if (this.storage.options.logDeleted) handleBulkDelete(action, options, limits);
                                break;
                            case "MESSAGE_UPDATE":
                                if (this.storage.options.logEdited) handleUpdate(action, options, limits);
                                break;
                        }
                    } catch {
                        // A broken capture should never block the actual dispatch from proceeding.
                    }
                }),
            );
        },
        onStop() {},
    },
});
