import { chroma } from "@vendetta/metro/common";
import { rawColors } from "@vendetta/ui";
import { isValidHex } from "@shared/lib/color";
import { getUserTag } from "./tags";
import { getIcon, IconDef } from "./icons";

export interface ResolvedTag {
    text: string;
    textColor: any;
    backgroundColor: string;
    icon?: IconDef;
    iconColor: any;
}

export default function resolveTag(userId: string | undefined): ResolvedTag | undefined {
    const tag = getUserTag(userId);
    if ((!tag?.text && !tag?.icon) || !isValidHex(tag.color)) return undefined;

    const backgroundColor = tag.color;
    const textColor = chroma(backgroundColor).get("lab.l") < 70 ? rawColors.WHITE_500 : rawColors.BLACK_500;
    const icon = getIcon(tag.icon);

    return {
        text: tag.text || "",
        textColor,
        backgroundColor,
        icon,
        iconColor: textColor
    };
}
