import { storage } from "@vendetta/plugin";
import type { LoggedMessage } from "./types";

// Its own top-level storage key, deliberately separate from Module.ts's vstorage.modules[id].options
// bag (which the generic settings UI treats as a flat map of small config values) - this can grow to
// thousands of entries, which doesn't belong mixed into that.
const logStorage = storage as { messageLoggerLog?: LoggedMessage[] };

export function getLog(): LoggedMessage[] {
    logStorage.messageLoggerLog ??= [];
    return logStorage.messageLoggerLog;
}

function pruneLog(maxEntries: number, maxAgeDays: number, maxPerChannel: number): void {
    let log = getLog();

    if (maxAgeDays > 0) {
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        log = log.filter((e) => new Date(e.loggedAt).getTime() >= cutoff);
    }

    if (maxPerChannel > 0) {
        const perChannelCount = new Map<string, number>();
        const kept: LoggedMessage[] = [];
        // Walk newest-first so the entries kept per channel are always the most recent ones.
        for (let i = log.length - 1; i >= 0; i--) {
            const entry = log[i];
            const count = perChannelCount.get(entry.channelId) ?? 0;
            if (count >= maxPerChannel) continue;
            perChannelCount.set(entry.channelId, count + 1);
            kept.push(entry);
        }
        log = kept.reverse();
    }

    if (maxEntries > 0 && log.length > maxEntries) {
        log = log.slice(log.length - maxEntries);
    }

    logStorage.messageLoggerLog = log;
}

export function addLogEntry(entry: LoggedMessage, limits: { maxEntries: number; maxAgeDays: number; maxPerChannel: number }): void {
    getLog().push(entry);
    pruneLog(limits.maxEntries, limits.maxAgeDays, limits.maxPerChannel);
}

export function removeLogEntry(loggedAt: string): void {
    logStorage.messageLoggerLog = getLog().filter((e) => e.loggedAt !== loggedAt);
}

export function clearLog(): void {
    logStorage.messageLoggerLog = [];
}
