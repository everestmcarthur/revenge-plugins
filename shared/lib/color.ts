export const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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
