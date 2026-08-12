import { findByProps } from "@vendetta/metro";
import type { ComponentType } from "react";
import type { ColorValue, ImageProps } from "react-native";

export type SizeKey = "EXTRA_SMALL_10" | "EXTRA_SMALL" | "SMALL" | "SMALL_20" | "MEDIUM" | "LARGE" | "CUSTOM" | "REFRESH_SMALL_16" | "SMALL_14";

export interface IconProps extends Pick<ImageProps, "accessible" | "accessibilityLabel" | "resizeMode" | "source" | "style"> {
    size?: string | undefined;
    color?: ColorValue | undefined;
    disableColor?: boolean | undefined;
}

// A bare `() => null` fallback has no .Sizes for callers like Icon.Sizes.LARGE to read before
// the real module resolves - this static map keeps Icon.Sizes always valid.
const FALLBACK_SIZES: Record<SizeKey, string> = {
    EXTRA_SMALL_10: "extra_small_10", EXTRA_SMALL: "extra_small", SMALL: "small", SMALL_20: "small_20",
    MEDIUM: "medium", LARGE: "large", CUSTOM: "custom", REFRESH_SMALL_16: "refresh_small_16", SMALL_14: "small_14",
};

const resolvedIcon = (findByProps("IconSizes") as Record<string, any> | undefined)?.default;

export const Icon: ComponentType<IconProps> & {
    Sizes: Record<SizeKey, string>;
} = resolvedIcon ?? Object.assign(() => null, { Sizes: FALLBACK_SIZES });
