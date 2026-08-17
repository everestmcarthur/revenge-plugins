import { chroma } from "@vendetta/metro/common";
import { rawColors } from "@vendetta/ui";
import { isValidHex } from "@shared/lib/color";
import { getUserTag, UserTag } from "./tags";
import { getIcon, isValidCustomSvg, IconDef } from "./icons";

export interface ResolvedTag {
    text: string;
    textColor: any;
    backgroundColor: string;
    icon?: IconDef;
    iconColor: any;
}

function resolveIcon(tag: UserTag): IconDef | undefined {
    if (tag.customSvg && isValidCustomSvg(tag.customSvg)) {
        return { id: "custom", name: "Custom", fallback: tag.customSvgFallback?.trim() || "", svg: tag.customSvg.trim() };
    }
    return getIcon(tag.icon);
}

export default function resolveTag(userId: string | undefined): ResolvedTag | undefined {
    const tag = getUserTag(userId);
    if ((!tag?.text && !tag?.icon && !tag?.customSvg) || !isValidHex(tag.color)) return undefined;

    const backgroundColor = tag.color;
    const textColor = chroma(backgroundColor).get("lab.l") < 70 ? rawColors.WHITE_500 : rawColors.BLACK_500;
    const icon = resolveIcon(tag);

    return {
        text: tag.iconOnly && icon ? "" : tag.text || "",
        textColor,
        backgroundColor,
        icon,
        iconColor: textColor
    };
}
