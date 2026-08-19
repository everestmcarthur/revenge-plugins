import { getSettings } from "./accounts";

export interface LogEntry {
    timestamp: string;
    type: "debug" | "info" | "warn" | "error";
    message: string;
    data?: unknown;
}

const TAG = "[MoreAlts]";
const MAX_LOGS = 1000;
const logs: LogEntry[] = [];

export function addLog(type: LogEntry["type"], message: string, data?: unknown) {
    logs.unshift({ timestamp: new Date().toISOString(), type, message, data });
    if (logs.length > MAX_LOGS) logs.pop();

    if (getSettings().enableUnsafeFeatures) {
        console.log(`${TAG} ${type.toUpperCase()}: ${message}`, data ?? "");
    }
}

export function getLogs(): LogEntry[] {
    return logs;
}

export function clearLogs() {
    logs.length = 0;
    addLog("info", "Logs cleared");
}
