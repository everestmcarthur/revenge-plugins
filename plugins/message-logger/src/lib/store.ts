import { storage } from "@vendetta/plugin";
import type { LoggedMessage } from "./types";

const logStorage = storage as { log?: LoggedMessage[] };

export function getLog(): LoggedMessage[] {
    logStorage.log ??= [];
    return logStorage.log;
}

function pruneLog(maxEntries: number, maxAgeDays: number, maxPerChannel: number): void {
    let log = getLog();

    if (maxAgeDays > 0) {
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        log = log.filter((e) => e.loggedAt >= cutoff);
    }

    if (maxPerChannel > 0) {
        const perChannelCount = new Map<string, number>();
        const kept: LoggedMessage[] = [];
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

    logStorage.log = log;
}

export function addLogEntry(entry: LoggedMessage, limits: { maxEntries: number; maxAgeDays: number; maxPerChannel: number }): void {
    getLog().push(entry);
    pruneLog(limits.maxEntries, limits.maxAgeDays, limits.maxPerChannel);
}

export function removeLogEntry(loggedAt: number): void {
    logStorage.log = getLog().filter((e) => e.loggedAt !== loggedAt);
}

export function clearLog(): void {
    logStorage.log = [];
}
