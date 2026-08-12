/* eslint-disable @stylistic/brace-style */

const DELIMITER_CODEPOINT = 0x200B; // zero-width space
const DELIMITER = String.fromCodePoint(DELIMITER_CODEPOINT);
const RADIX = 0x1000; // count of default-ignorable codepoints in the SSP plane
const STARTING_CODEPOINT = 0xE0000; // first codepoint in the SSP plane
const ENDING_CODEPOINT = STARTING_CODEPOINT + RADIX - 1;

/** Legacy format: `[#primary,#accent]`, each codepoint offset by +STARTING_CODEPOINT. */
export function encodeColorsLegacy(primary: number, accent: number) {
    return String.fromCodePoint(...[...`[#${primary.toString(16)},#${accent.toString(16)}]`]
        .map(c => c.codePointAt(0)! + STARTING_CODEPOINT));
}

/** @returns [primary, accent] colors, or -1 for either if not found. */
export function decodeColorsLegacy(str: string): [primaryColor: number, accentColor: number] {
    const [primary, accent] = str.matchAll(/(?<=#)[\dA-Fa-f]{1,6}/g);
    return [primary ? parseInt(primary[0], 16) : -1, accent ? parseInt(accent[0], 16) : -1];
}

/** Base-RADIX encoding of a 24-bit color, each codepoint offset by +STARTING_CODEPOINT. */
export function encodeColor(color: number) {
    if (color === 0) return String.fromCodePoint(STARTING_CODEPOINT);
    let str = "";
    for (; color > 0; color = Math.trunc(color / RADIX))
        str = String.fromCodePoint(color % RADIX + STARTING_CODEPOINT) + str;
    return str;
}

/** @returns the decoded 24-bit color; -1 if str is empty, -2 if over 0xFFFFFF. */
export function decodeColor(str: string) {
    if (str === "") return -1;
    let color = 0;
    for (let i = 0; i < str.length; i++) {
        if (color > 0xFFF_FFF) return -2;
        color += str.codePointAt(i)! * RADIX ** (str.length - 1 - i);
    }
    return color;
}

/** Base-RADIX encoding of an effect ID, each codepoint offset by +STARTING_CODEPOINT. */
export function encodeEffect(id: bigint) {
    if (id === 0n) return String.fromCodePoint(STARTING_CODEPOINT);
    let str = "";
    for (; id > 0n; id /= BigInt(RADIX))
        str = String.fromCodePoint(Number(id % BigInt(RADIX)) + STARTING_CODEPOINT) + str;
    return str;
}

/** @returns the decoded effect ID; -1n if str is empty, -2n if over the max effect ID. */
export function decodeEffect(str: string) {
    if (str === "") return -1n;
    let id = 0n;
    for (let i = 0; i < str.length; i++) {
        if (id >= 10_000_000_000_000_000_000n) return -2n;
        id += BigInt(str.codePointAt(i)!) * BigInt(RADIX) ** BigInt(str.length - 1 - i);
    }
    return id;
}

/**
 * Builds an FPTE string from primary/accent colors (negative = unset) and an effect ID (empty =
 * unset). In legacy mode, colors are legacy-encoded and both are always included (accent falls
 * back to primary, or vice versa); otherwise a shared/unset color is omitted to save space.
 */
export function buildFPTE(primary: number, accent: number, effect: string, legacy: boolean) {
    let fpte = "";

    if (legacy) {
        if (primary >= 0) {
            fpte = accent >= 0 ? encodeColorsLegacy(primary, accent) : encodeColorsLegacy(primary, primary);
            if (effect) fpte += DELIMITER + encodeEffect(BigInt(effect));
            return fpte;
        }
        if (accent >= 0) {
            fpte = encodeColorsLegacy(accent, accent);
            if (effect) fpte += DELIMITER + encodeEffect(BigInt(effect));
            return fpte;
        }
    }
    else if (primary >= 0) {
        fpte = encodeColor(primary);
        if (accent >= 0 && primary !== accent) {
            fpte += DELIMITER + encodeColor(accent);
            if (effect) fpte += DELIMITER + encodeEffect(BigInt(effect));
            return fpte;
        }
    }
    else if (accent >= 0) fpte = encodeColor(accent);

    // Only one (or no) color was written above, so the effect needs a double delimiter to mark
    // the skipped slot.
    if (effect)
        fpte += DELIMITER + DELIMITER + encodeEffect(BigInt(effect));

    return fpte;
}

/** Extracts the delimiter-separated values of the first FPTE substring in a string. */
export function extractFPTE(str: string) {
    const fpte: [maybePrimaryOrLegacy: string, maybeAccentOrEffect: string, maybeEffect: string] = ["", "", ""];
    let i = 0;

    for (const char of str) {
        const cp = char.codePointAt(0)!;

        if (cp === DELIMITER_CODEPOINT) {
            if (i >= 2) break;
            i++;
        }
        else if (cp >= STARTING_CODEPOINT && cp <= ENDING_CODEPOINT)
            fpte[i]! += String.fromCodePoint(cp - STARTING_CODEPOINT);
        else if (i > 0 || fpte[0]) break;
    }

    return fpte;
}

/** Detects an FPTE substring by the presence of FPTE codepoints or the delimiter. */
export function hasFPTE(str: string): boolean {
    for (const char of str) {
        const cp = char.codePointAt(0)!;
        if ((cp >= STARTING_CODEPOINT && cp <= ENDING_CODEPOINT) || cp === DELIMITER_CODEPOINT) {
            return true;
        }
    }
    return false;
}

export function stripFPTE(str: string) {
    return [...str]
        .filter(ch => {
            const cp = ch.codePointAt(0)!;
            return (cp < STARTING_CODEPOINT || cp > ENDING_CODEPOINT) && cp !== DELIMITER_CODEPOINT;
        })
        .join("")
        .trim();
}
