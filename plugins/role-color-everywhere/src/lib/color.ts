import { resolveSemanticColorSafe } from "@shared/lib/color";

export { interpolateColor } from "@shared/lib/color";

export function defaultTextColor(): string | undefined {
    return resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");
}
