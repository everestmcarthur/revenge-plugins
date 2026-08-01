import { findByProps } from "@vendetta/metro";

let cached: any;
let attempted = false;

/**
 * Discord ships a native gradient view (used for boost/nitro badges) but it isn't part of any
 * stable public API, so this is a best-effort lookup that quietly returns null if it can't be found -
 * gradient tags then fall back to a solid color instead of crashing anything.
 */
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
