import { resolveSemanticColorSafe } from "@shared/lib/color";

export { interpolateColor } from "@shared/lib/color";

// TEXT_NORMAL was a bare, un-guarded reference here (confirmed dead via Key Inspector - Discord
// renamed its whole semanticColors scheme, TEXT_NORMAL -> TEXT_DEFAULT among others), unlike every
// other token lookup in this repo which already goes through a multi-candidate fallback chain.
export function defaultTextColor(): string | undefined {
    return resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");
}
