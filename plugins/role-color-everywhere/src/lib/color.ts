import { find, findByStoreName } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";

export const ThemeStore = findByStoreName("ThemeStore");

export const resolveSemanticColor =
    find((m: any) => m?.default?.internal?.resolveSemanticColor)?.default?.internal?.resolveSemanticColor ??
    find((m: any) => m?.meta?.resolveSemanticColor)?.meta?.resolveSemanticColor ??
    (() => undefined);

export function interpolateColor(color1: string, color2: string, percentage: number): string {
    const hexToRgb = (hex: string) => (hex.match(/\w\w/g) ?? ["00", "00", "00"]).map((x) => parseInt(x, 16));
    const rgbToHex = (rgb: number[]) => "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("");

    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    const interpolated = rgb1.map((c1, i) => Math.round(c1 + (rgb2[i] - c1) * percentage));

    return rgbToHex(interpolated);
}

export function defaultTextColor(): string | undefined {
    try {
        return resolveSemanticColor(ThemeStore?.theme, semanticColors.TEXT_NORMAL);
    } catch {
        return undefined;
    }
}
