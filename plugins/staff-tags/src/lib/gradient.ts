import { findByProps } from "@vendetta/metro";

let cached: any;
let attempted = false;

// Not a stable public API - best-effort lookup, falls back to a solid color if not found.
export function getGradientComponent(): any {
    if (attempted) return cached;
    attempted = true;

    try {
        cached =
            findByProps("colors", "start", "end")?.default ??
            findByProps("colors", "locations")?.default ??
            null;
    } catch {
        cached = null;
    }

    return cached;
}
