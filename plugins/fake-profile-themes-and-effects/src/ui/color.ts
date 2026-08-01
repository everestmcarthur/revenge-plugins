import { find, findByProps } from "@vendetta/metro";
import { semanticColors as _semanticColors } from "@vendetta/ui";
import type { ComponentType, PropsWithChildren } from "react";

import type { EmptyObject } from "@fpte/lib/utils";

export const semanticColors: Record<string, EmptyObject> = _semanticColors;

export const resolveSemanticColor: (theme: Theme, semanticColor: EmptyObject) => string
    = find(m => m.default?.internal?.resolveSemanticColor)?.default.internal.resolveSemanticColor
    ?? find(m => m.meta?.resolveSemanticColor)?.meta.resolveSemanticColor
    ?? (() => undefined);

/**
 * Discord renames semantic color tokens across versions - confirmed via live on-device diagnostics
 * that HEADER_SECONDARY, BACKGROUND_PRIMARY, BACKGROUND_FLOATING, and TEXT_NORMAL have all been
 * removed on at least one current build, which is exactly what crashed this plugin's profile editor
 * every time it rendered. This tries each candidate token name in order and never throws.
 */
export function resolveSemanticColorSafe(theme: Theme, tokenNames: string[], fallbackHex: string): string {
    for (const name of tokenNames) {
        const token = semanticColors?.[name];
        if (!token) continue;
        try {
            const resolved = resolveSemanticColor(theme, token);
            if (resolved) return resolved;
        } catch {
            // try the next candidate
        }
    }
    return fallbackHex;
}

export const useAvatarColors: (
    avatarUrl: string,
    fillerColor: string,
    desaturateColors?: boolean | undefined /* = true */
) => string[]
    = (findByProps("useAvatarColors") as Record<string, any> | undefined)?.useAvatarColors
    ?? (() => undefined);

export type Theme = "dark" | "light" | "midnight" | "darker";

export const getProfileTheme: <T extends number | null | undefined>(primaryColor: T) => T extends number ? Theme : null
    = findByProps("getProfileTheme").getProfileTheme;

export interface ThemeContext {
    theme: Theme;
    primaryColor: number | null;
    secondaryColor: number | null;
    gradient: {
        id: number;
        theme: Theme;
        colors: {
            stop: number;
            token: string;
        }[];
        angle: number;
        midpointPercentage: number;
        getName: () => string;
    } | null;
    flags: number;
    key: string;
}

export const useThemeContext: () => ThemeContext
    = (findByProps("useThemeContext") as Record<string, any> | undefined)?.useThemeContext
    ?? (() => ({}));

export type ThemeContextProviderProps = PropsWithChildren<Partial<ThemeContext>>;

export const ThemeContextProvider: ComponentType<ThemeContextProviderProps>
    = (findByProps("ThemeContextProvider") as Record<string, any> | undefined)?.ThemeContextProvider
    ?? (({ children }) => children);
