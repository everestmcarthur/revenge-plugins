import { React } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { IconDef } from "../lib/icons";

const svgModule = findByProps("Svg") as Record<string, any> | undefined;
const Svg = svgModule?.Svg ?? (() => null);
const Path = svgModule?.Path ?? (() => null);
const SvgXml = svgModule?.SvgXml ?? (() => null);

interface IconProps {
    icon: IconDef;
    size?: number;
    color?: string;
    style?: any;
}

export default function Icon({ icon, size = 12, color = "#fff", style }: IconProps) {
    // Custom SVGs keep their own authored colors - no fill override, unlike preset icons below.
    if (icon.svg) return <SvgXml xml={icon.svg} width={size} height={size} style={style} />;

    if (!icon.path) return null;
    const viewBox = icon.viewBox ?? "0 0 24 24";
    return (
        <Svg width={size} height={size} viewBox={viewBox} fill={color} style={style}>
            <Path d={icon.path} />
        </Svg>
    );
}
