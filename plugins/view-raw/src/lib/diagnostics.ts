import { storage } from "@vendetta/plugin";

export type DetectionStrategy = "buttons" | "actionSheetRow" | "generic" | "none";

export interface Detection {
    strategy: DetectionStrategy;
    detail: string;
    timestamp: number;
}

/** Records which fallback (if any) successfully found a place to inject the "View Raw" button. */
export function recordDetection(strategy: DetectionStrategy, detail = "") {
    storage.lastDetection = { strategy, detail, timestamp: Date.now() } as Detection;
}

export function getLastDetection(): Detection | undefined {
    return storage.lastDetection as Detection | undefined;
}
