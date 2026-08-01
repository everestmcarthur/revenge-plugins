import { find, findByStoreName } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";

export { interpolateColor } from "@shared/lib/color";

export const ThemeStore = findByStoreName("ThemeStore");

export const resolveSemanticColor =
    find((m: any) => m?.default?.internal?.resolveSemanticColor)?.default?.internal?.resolveSemanticColor ??
    find((m: any) => m?.meta?.resolveSemanticColor)?.meta?.resolveSemanticColor ??
    (() => undefined);

export function defaultTextColor(): string | undefined {
    try {
        return resolveSemanticColor(ThemeStore?.theme, semanticColors.TEXT_NORMAL);
    } catch {
        return undefined;
    }
}
