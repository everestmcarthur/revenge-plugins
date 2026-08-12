import type { UserRecord } from "@vencord/discord-types";
import { findByName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import React, { type ReactElement, type ReactNode, useMemo } from "react";

import { findElementInTree, findParentInTree, getComponentNameFromType, type RN } from "@fpte/lib/reactNativeRenderTree";
import { ProfileEffectRecord } from "@fpte/lib/records";
import type { ProfileEffect, ProfileEffectConfig } from "@fpte/lib/stores";
import { setPreviewUserId } from "@fpte/patches/patchUseProfileTheme";
import { FallbackEffectPickerActionSheet } from "@fpte/ui/actionSheets";
import { ThemeContextProvider, useThemeContext } from "@fpte/ui/color";

export interface EffectPickerActionSheetProps {
    effects: ProfileEffect[];
    onSelect: (effect: ProfileEffectConfig | null) => void;
    user: UserRecord;
    currentEffectId?: string | undefined;
}

const EffectPicker: RN.FunctionComponent | undefined = findByName("EditProfileEffectActionSheet");

let lastGoodTree: RN.Node;

function PatchedEffectPickerActionSheet(props: EffectPickerActionSheetProps) {
    const { currentEffectId, effects, onSelect, user } = props;

    // Must be checked before EffectPicker is called below - that call chains Discord's own hooks
    // onto this fiber, so checking the setting after the call still pays the crash it's meant to
    // avoid. forceFallbackEffectPicker doesn't change while mounted, so this early return is safe.
    if (storage.forceFallbackEffectPicker)
        return <FallbackEffectPickerActionSheet {...props} />;

    const tree = EffectPicker!({ user });

    const themeContext = useThemeContext();

    // Must be built from effect.config, not our {id, skuId, config} wrapper - the wrapper leaves
    // everything but skuId/type undefined.
    const effectRecords = useMemo(() => effects.map(effect => ({ items: new ProfileEffectRecord(effect.config) })), [effects]);

    let isLegacyEffectPicker = false;
    const effectPickerInner: RN.Element<any> | null = findElementInTree(tree, element => {
        if (getComponentNameFromType(element.type) === "EditProfileEffectInner")
            return true;
        if (
            "profileEffects" in element.props
            && "selectedProfileEffect" in element.props
            && typeof (element.props as any).setSelectedProfileEffect === "function"
        ) return isLegacyEffectPicker = true;
        return false;
    });
    if (!effectPickerInner) {
        if (lastGoodTree) return lastGoodTree as ReactElement;
        return <FallbackEffectPickerActionSheet {...props} />;
    }

    const applyButton: RN.Element<any> | null = findElementInTree(tree, element => getComponentNameFromType(element.type) === "Button");
    if (!applyButton) {
        if (lastGoodTree) return lastGoodTree as ReactElement;
        return <FallbackEffectPickerActionSheet {...props} />;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (isLegacyEffectPicker) {
        if (effectPickerInner.props.selectedProfileEffect === undefined)
            effectPickerInner.props.setSelectedProfileEffect(props.currentEffectId
                ? { id: props.currentEffectId }
                : null);
        effectPickerInner.props.profileEffects = props.effects;

        const profilePreview = findParentInTree(tree, children =>
            Array.isArray(children) && children.some(child =>
                getComponentNameFromType(child.type) === "DisplayBanner"));
        if (profilePreview) {
            const baseProvider = tree as RN.Element<any>;

            profilePreview.props.children = (
                <ThemeContextProvider
                    theme={baseProvider.props.theme}
                    primaryColor={baseProvider.props.primaryColor}
                    secondaryColor={baseProvider.props.secondaryColor}
                    children={profilePreview.props.children as ReactNode}
                />
            );

            baseProvider.props.theme = themeContext.theme;
            baseProvider.props.primaryColor = themeContext.primaryColor;
            baseProvider.props.secondaryColor = themeContext.secondaryColor;
        }
    } else {
        if (effectPickerInner.props.selectedProfileEffect === undefined)
            effectPickerInner.props.setSelectedProfileEffect(currentEffectId
                ? new ProfileEffectRecord({ skuId: currentEffectId } as any)
                : null);
        effectPickerInner.props.purchases = effectRecords;
    }

    setPreviewUserId(user.id);
    applyButton.props.onPress = () => {
        setPreviewUserId(undefined);
        // selectedProfileEffect has no .id field, only .skuId.
        onSelect(effects.find(effect => effect.skuId === effectPickerInner.props.selectedProfileEffect?.skuId)?.config ?? null);
    };

    return (lastGoodTree = tree) as ReactElement;
}

export const EffectPickerActionSheet = EffectPicker
    ? PatchedEffectPickerActionSheet
    : FallbackEffectPickerActionSheet;
