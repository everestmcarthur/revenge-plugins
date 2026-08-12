import { find, findByStoreName } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";

export const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const ThemeStore = findByStoreName("ThemeStore");

// @vendetta/ui exposes the semanticColors token map but not a resolver function for it.
const rawResolveSemanticColor: (theme: any, semanticColor: any) => string | undefined =
    find((m: any) => m?.default?.internal?.resolveSemanticColor)?.default?.internal?.resolveSemanticColor ??
    find((m: any) => m?.meta?.resolveSemanticColor)?.meta?.resolveSemanticColor ??
    (() => undefined);

/** Resolves a semanticColors[TOKEN_NAME] descriptor to a real color for the current theme. */
export function resolveSemanticColor(token: any, theme: any = ThemeStore?.theme): string | undefined {
    if (!token) return undefined;
    try {
        return rawResolveSemanticColor(theme, token);
    } catch {
        return undefined;
    }
}

// Tries a list of token names in order, falling back to a hardcoded hex color - Discord renames
// these tokens across versions often enough that a single hardcoded name isn't reliable.
export function resolveSemanticColorSafe(tokenNames: string[], fallbackHex: string, theme: any = ThemeStore?.theme): string {
    for (const name of tokenNames) {
        const token = (semanticColors as Record<string, any> | undefined)?.[name];
        if (!token) continue;
        const resolved = resolveSemanticColor(token, theme);
        if (resolved) return resolved;
    }
    return fallbackHex;
}

export function isValidHex(value: string | undefined | null): value is string {
    return !!value && HEX_REGEX.test(value);
}

/** Expands short form #abc to #aabbcc; leaves 6-digit hex untouched. */
export function normalizeHex(hex: string): string {
    if (hex.length === 4) {
        return "#" + hex.slice(1).split("").map((c) => c + c).join("");
    }
    return hex;
}

export function interpolateColor(color1: string, color2: string, percentage: number): string {
    const hexToRgb = (hex: string) => (normalizeHex(hex).match(/\w\w/g) ?? ["00", "00", "00"]).map((x) => parseInt(x, 16));
    const rgbToHex = (rgb: number[]) => "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("");

    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    const interpolated = rgb1.map((c1, i) => Math.round(c1 + (rgb2[i] - c1) * percentage));

    return rgbToHex(interpolated);
}
