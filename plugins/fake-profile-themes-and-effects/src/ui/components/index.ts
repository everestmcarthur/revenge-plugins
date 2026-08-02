import type { FlashList as $FlashList } from "@shopify/flash-list";
import { findByProps } from "@vendetta/metro";
import type { ComponentType } from "react";
import type { PressableProps } from "react-native";
import type { Path as $Path, Svg as $Svg } from "react-native-svg";

export * from "./Builder";
export * from "./BuilderButton";
export * from "./Button";
export * as Forms from "./forms";
export * from "./Icon";
export * from "./StaticEffect";
export * from "./Text";

// findByName("FlashList") never matches - confirmed live (Key Inspector's Eval console, a full
// module-key scan) that the exported property is still literally named FlashList, but findByName
// matches by the component's own runtime .name/.displayName, which doesn't survive production
// minification the way the export's property key does. findByProps looks at property keys instead.
const flashListModule = findByProps("FlashList") as Record<string, any> | undefined;
export const FlashList: typeof $FlashList = flashListModule?.FlashList ?? (() => null);

// Must use `as` or else `undefined` is lost due to a TS bug
const svgModule = findByProps("Svg") as Record<string, any> | undefined;
export const Svg: typeof $Svg = svgModule?.Svg ?? (() => null);
export const Path: typeof $Path = svgModule?.Path ?? (() => null);

export interface PressableOpacityProps extends PressableProps {
    activeOpacity?: number | undefined;
}

export const PressableOpacity: ComponentType<PressableOpacityProps>
    = (findByProps("PressableOpacity") as Record<string, any> | undefined)?.PressableOpacity
    ?? (() => null);
