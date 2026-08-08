import { React } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { IconDef } from "../lib/icons";

const svgModule = findByProps("Svg") as Record<string, any> | undefined;
const Svg = svgModule?.Svg ?? (() => null);
const Path = svgModule?.Path ?? (() => null);

interface IconProps {
    icon: IconDef;
    size?: number;
    color?: string;
    style?: any;
}

export default function Icon({ icon, size = 12, color = "#fff", style }: IconProps) {
    if (!icon.path) return null;
    const viewBox = icon.viewBox ?? "0 0 24 24";
    return (
        <Svg width={size} height={size} viewBox={viewBox} fill={color} style={style}>
            <Path d={icon.path} />
        </Svg>
    );
}
