import React, { type ReactNode, useContext, useMemo, useState } from "react";
import { View, type ViewStyle } from "react-native";

import { HapticFeebackTypes, triggerHapticFeedback } from "@fpte/lib/haptics";
import type { ProfileEffect } from "@fpte/lib/stores";
import { BottomSheet, BottomSheetScrollView, type EffectPickerActionSheetProps } from "@fpte/ui/actionSheets";
import { IMG_NONE } from "@fpte/ui/assets";
import { resolveSemanticColorSafe, useThemeContext } from "@fpte/ui/color";
import { Button, FlashList, Icon, PressableOpacity, StaticEffect, Text } from "@fpte/ui/components";
import { Radius, SafeAreaContext, Spacing, useWindowDimensions } from "@fpte/ui/length";

const ROW_SIZE = 3;

// lodash isn't a dependency of this repo (no node_modules/lodash, nothing in package.json) - the
// build's Rollup config only marks react/react-native external, so an unresolved "lodash" import
// got emitted as a bare, undefined global reference in the compiled bundle. That threw
// "ReferenceError: lodash is not defined" the instant Revenge evaluated this plugin's bundle,
// before onLoad ever ran - which is why enabling the plugin silently reverted with no visible
// error anywhere. Only one function was ever used from it, so it's inlined here instead.
function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
}

interface ItemProps {
    label: string;
    isSelected: boolean;
    size: number;
    colors: [bgColor: string, itemColor: string, selectedColor: string];
    onPress: () => void;
    style?: ViewStyle | undefined;
    children: Exclude<ReactNode, number | string>;
}

function Item({ label, isSelected, size, colors, onPress, style, children }: ItemProps) {
    const [bgColor, itemColor, selectedColor] = colors;

    return (
        <PressableOpacity
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            disabled={isSelected}
            onPress={() => {
                triggerHapticFeedback(HapticFeebackTypes.IMPACT_LIGHT);
                onPress();
            }}
            style={[
                {
                    height: size,
                    width: size,
                    overflow: "hidden",
                    backgroundColor: itemColor,
                    borderColor: bgColor,
                    borderRadius: Radius.sm,
                    borderWidth: 2
                },
                isSelected && { borderColor: selectedColor },
                style
            ]}
        >
            {children}
        </PressableOpacity>
    );
}

export type FallbackEffectPickerActionSheetProps = Pick<EffectPickerActionSheetProps, "currentEffectId" | "effects" | "onSelect">;

export function FallbackEffectPickerActionSheet({ currentEffectId, effects, onSelect }: FallbackEffectPickerActionSheetProps) {
    const [selectedId, setSelectedId] = useState(currentEffectId);
    const [itemSize, setItemSize] = useState(0);

    const { theme } = useThemeContext();
    const colors: ItemProps["colors"] = useMemo(() => [
        resolveSemanticColorSafe(theme, ["BACKGROUND_PRIMARY", "BACKGROUND_BASE_LOWER", "BACKGROUND_BASE_LOW"], "#1E1F22"),
        resolveSemanticColorSafe(theme, ["BACKGROUND_FLOATING", "MOBILE_FLOATINGBAR_BACKGROUND", "BACKGROUND_BASE_LOWER"], "#2B2D31"),
        resolveSemanticColorSafe(theme, ["BUTTON_OUTLINE_BRAND_BORDER_ACTIVE", "BORDER_FOCUS"], "#5865F2")
    ], [theme]);

    const windowDimensions = useWindowDimensions();
    const safeArea = useContext(SafeAreaContext);

    const effectRows = useMemo(() => {
        const effectChunks: (ProfileEffect | null | undefined)[][] = chunk([null, ...effects], ROW_SIZE);
        const lastChunk = effectChunks[effectChunks.length - 1]!;
        while (lastChunk.length < 3) lastChunk.push(undefined);
        return effectChunks;
    }, [effects]);

    return (
        <BottomSheet
            transparentHeader={true}
            scrollable={true}
            startExpanded={true}
            startHeight={windowDimensions.height - safeArea.top}
        >
            <BottomSheetScrollView
                scrollsToTop={false}
            >
                <View
                    style={{
                        flex: 1,
                        flexDirection: "column",
                        alignItems: "center",
                        paddingBottom: 88
                    }}
                >
                    <Text
                        variant="redesign/heading-18/bold"
                        color="header-primary"
                        style={{ margin: Spacing.PX_16 }}
                    >
                        {currentEffectId ? "Change Effect" : "Add Profile Effect"}
                    </Text>
                    <View
                        style={{
                            width: "72%",
                            minHeight: 38
                        }}
                    >
                        <Text
                            variant="heading-md/bold"
                            color="header-primary"
                            style={{ textAlign: "center" }}
                        >
                            {effects.find(effect => effect.id === selectedId)?.config.title ?? "None"}
                        </Text>
                    </View>
                    <View
                        style={{
                            flex: 1,
                            width: "92%",
                            marginTop: 3
                        }}
                    >
                        <FlashList
                            accessibilityLabel="Profile Effect Selection Section"
                            numColumns={1}
                            estimatedItemSize={98}
                            ItemSeparatorComponent={() => <View style={{ height: Spacing.PX_16 }} />}
                            contentContainerStyle={{ paddingHorizontal: Spacing.PX_4 }}
                            data={effectRows}
                            extraData={selectedId}
                            renderItem={({ item }) => (
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        paddingHorizontal: Spacing.PX_16
                                    }}
                                >
                                    {item.map(effect => effect
                                        ? (
                                            <Item
                                                label={effect.config.accessibilityLabel}
                                                isSelected={effect.id === selectedId}
                                                size={itemSize}
                                                colors={colors}
                                                onPress={() => { setSelectedId(effect.id); }}
                                            >
                                                <StaticEffect effect={effect.config} />
                                            </Item>
                                        )
                                        : effect === null
                                            ? (
                                                <Item
                                                    label="None"
                                                    isSelected={!selectedId}
                                                    size={itemSize}
                                                    colors={colors}
                                                    onPress={() => { setSelectedId(undefined); }}
                                                    style={{
                                                        alignItems: "center",
                                                        justifyContent: "center"
                                                    }}
                                                >
                                                    <Icon
                                                        source={IMG_NONE}
                                                        size={Icon.Sizes.LARGE}
                                                    />
                                                    <Text
                                                        variant="text-sm/medium"
                                                        color="header-primary"
                                                        style={{ marginTop: Spacing.PX_4 }}
                                                    >
                                                        None
                                                    </Text>
                                                </Item>
                                            )
                                            : (
                                                <View
                                                    style={{
                                                        width: itemSize,
                                                        height: itemSize
                                                    }}
                                                />
                                            )
                                    )}
                                </View>
                            )}
                            onLayout={event => { setItemSize((event.nativeEvent.layout.width - 64) / ROW_SIZE); }}
                        />
                    </View>
                </View>
            </BottomSheetScrollView>
            <Button
                text="Apply"
                textStyle={{ fontSize: 16 }}
                onPress={() => { onSelect(effects.find(effect => effect.id === selectedId)?.config ?? null); }}
                style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    left: 0,
                    height: 48,
                    marginHorizontal: 36,
                    marginBottom: Spacing.PX_48,
                    borderRadius: Radius.round
                }}
            />
        </BottomSheet>
    );
}
