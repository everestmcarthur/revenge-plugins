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

    // This has to be the very first thing checked, before EffectPicker is ever called below -
    // that call runs Discord's own EditProfileEffectActionSheet as a plain function from inside
    // this component's own render, which chains its internal hooks onto this fiber. Checking the
    // setting only *after* that call (as this used to) still paid that cost on every render
    // regardless of the setting - the crash it exists to avoid had already happened by the time
    // the fallback kicked in. forceFallbackEffectPicker doesn't change while this component is
    // mounted, so returning early here before any hooks run is safe across this component's own
    // re-renders.
    if (storage.forceFallbackEffectPicker)
        return <FallbackEffectPickerActionSheet {...props} />;

    const tree = EffectPicker!({ user });

    const themeContext = useThemeContext();

    const effectRecords = useMemo(() => effects.map(effect => ({ items: new ProfileEffectRecord(effect) })), [effects]);

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
                ? new ProfileEffectRecord({ id: currentEffectId } as any)
                : null);
        effectPickerInner.props.purchases = effectRecords;
    }

    setPreviewUserId(user.id);
    applyButton.props.onPress = () => {
        setPreviewUserId(undefined);
        onSelect(effects.find(effect => effect.id === effectPickerInner.props.selectedProfileEffect?.id)?.config ?? null);
    };

    return (lastGoodTree = tree) as ReactElement;
}

export const EffectPickerActionSheet = EffectPicker
    ? PatchedEffectPickerActionSheet
    : FallbackEffectPickerActionSheet;
