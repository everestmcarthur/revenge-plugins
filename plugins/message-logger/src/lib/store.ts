import { storage } from "@vendetta/plugin";
import type { LoggedMessage } from "./types";

const logStorage = storage as { log?: LoggedMessage[] };

export interface LogLimits {
    maxEntries: number;
    maxAgeDays: number;
    maxPerChannel: number;
}

function numberOption(raw: string | undefined, fallback: number): number {
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function logLimitsFromStorage(): LogLimits {
    const o = (storage as any).options ?? {};
    return {
        maxEntries: numberOption(o.maxEntries, 2000),
        maxAgeDays: numberOption(o.maxAgeDays, 30),
        maxPerChannel: numberOption(o.maxEntriesPerChannel, 0),
    };
}

let onMutate: (() => void) | undefined;
export function setOnMutate(cb: (() => void) | undefined): void {
    onMutate = cb;
}

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

export function addLogEntry(entry: LoggedMessage, limits: LogLimits): void {
    getLog().push(entry);
    pruneLog(limits.maxEntries, limits.maxAgeDays, limits.maxPerChannel);
    onMutate?.();
}

export function removeLogEntry(loggedAt: number): void {
    logStorage.log = getLog().filter((e) => e.loggedAt !== loggedAt);
    onMutate?.();
}

export function clearLog(): void {
    logStorage.log = [];
    onMutate?.();
}

/** Replaces the entire log (used when merging in a remote copy) and re-applies the usual limits. */
export function replaceLog(entries: LoggedMessage[], limits: LogLimits): void {
    logStorage.log = entries;
    pruneLog(limits.maxEntries, limits.maxAgeDays, limits.maxPerChannel);
}
