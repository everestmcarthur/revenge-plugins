import { moment } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";

export type TimestampMode = "calendar" | "relative" | "custom" | "iso";

export default function renderTimestamp(timestamp: any, mode: TimestampMode = storage.selected): string {
    try {
        if (
            storage.hideDateIfToday &&
            (mode === "calendar" || mode === "custom") &&
            typeof timestamp.isSame === "function" &&
            timestamp.isSame(moment(), "day")
        ) {
            return timestamp.format("LT");
        }
        switch (mode) {
            case "calendar": return timestamp.calendar();
            case "relative": return timestamp.fromNow();
            case "iso": return timestamp.toISOString();
            case "custom": return timestamp.format(storage.customFormat || "dddd, MMMM Do YYYY, h:mm:ss a");
            default: return timestamp.calendar();
        }
    } catch {
        return timestamp?.calendar?.() ?? String(timestamp);
    }
}
