import { findByProps } from "@vendetta/metro";
import { logger } from "@vendetta";
import { showToast } from "@vendetta/ui/toasts";

const { openLazy } = findByProps("openLazy", "hideActionSheet") || {};

export function makeDefaults(object: any, defaults: any) {
    if (object != null && defaults != null) {
        for (const key of Object.keys(defaults)) {
            if (typeof defaults[key] === "object" && !Array.isArray(defaults[key]) && defaults[key] !== null) {
                if (typeof object[key] !== "object" || object[key] === null) object[key] = {};
                makeDefaults(object[key], defaults[key]);
            } else {
                object[key] ??= defaults[key];
            }
        }
    }
}

export function openSheet(sheet: any, props?: any) {
    try {
        if (openLazy) {
            openLazy(
                Promise.resolve({ default: sheet }),
                "ActionSheet",
                props
            );
        }
    } catch (e: any) {
        logger.error(e?.stack ?? e);
        showToast("Error opening ActionSheet");
    }
}

export const setOpacity = (hex: string, alpha: number) =>
    `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;

export const colorConverter = {
    toInt(hex: string) {
        hex = hex.replace(/^#/, "");
        return parseInt(hex, 16);
    },
    toHex(integer: number) {
        const hex = integer.toString(16).toUpperCase();
        return "#" + hex;
    },
    HSLtoHEX(h: number, s: number, l: number) {
        l /= 100;
        const a = (s * Math.min(l, 1 - l)) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, "0");
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    },
};

export function validateHex(input: string | undefined | null, defaultColor = "#000000") {
    if (!input) return defaultColor;
    const trimmedInput = input.trim();
    if (trimmedInput.startsWith("#")) {
        const hexCode = trimmedInput.slice(1);
        if (/^[0-9A-Fa-f]{6}$/.test(hexCode)) {
            return "#" + hexCode.toUpperCase();
        }
    } else {
        if (/^[0-9A-Fa-f]{6}$/.test(trimmedInput)) {
            return "#" + trimmedInput.toUpperCase();
        }
    }
    return defaultColor;
}
