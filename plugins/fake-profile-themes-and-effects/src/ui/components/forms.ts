import { TableRow, TableRowGroup, TableSwitchRow } from "@shared/ui/table";
import type { ComponentType, ReactNode } from "react";
import type { ColorValue, PressableProps, ViewProps } from "react-native";

import type { TextProps } from "@fpte/ui/components/Text";

interface CardProps {
    start?: boolean | undefined;
    end?: boolean | undefined;
    shadow?: string | undefined;
    border?: string | undefined;
    variant?: string | undefined;
}

export interface ViewCardProps extends CardProps, ViewProps { }

export interface PressableCardProps extends CardProps, PressableProps { }

interface TableRowProps {
    label?: ReactNode;
    subLabel?: ReactNode;
    icon?: ReactNode;
    trailing?: ReactNode;
    arrow?: boolean | undefined;
    labelLineClamp?: TextProps["lineClamp"];
    subLabelLineClamp?: TextProps["lineClamp"];
}

export interface ViewTableRowProps extends TableRowProps, ViewCardProps { }

export interface PressableTableRowProps extends TableRowProps, PressableCardProps { }

export interface FormTitleProps {
    title: string;
    icon?: ViewProps["children"];
    textStyle?: TextProps["style"];
    viewStyle?: ViewProps["style"];
    numberOfLines: TextProps["numberOfLines"];
    inset?: boolean | undefined;
    thinTitle?: boolean | undefined;
    uppercaseTitle?: boolean | undefined;
    error?: boolean | undefined;
}

export type TitleStyleType = "default" | "no_border" | "no_border_or_margin";

export interface FormSection extends Omit<FormTitleProps, "numberOfLines" | "textStyle" | "viewStyle">, Pick<ViewProps, "accessibilityLabel" | "accessibilityRole" | "children"> {
    description?: ViewProps["children"];
    hint?: ViewProps["children"];
    titleStyleType?: TitleStyleType | undefined;
    titleTextStyle?: FormTitleProps["textStyle"];
    titleViewStyle?: FormTitleProps["viewStyle"];
    sectionBodyStyle?: ViewProps["style"];
    hasIcons?: boolean | undefined;
}

export interface FormLabelProps extends Pick<TextProps, "accessible" | "color" | "numberOfLines" | "style"> {
    text?: TextProps["children"];
}

export interface FormRowProps extends Pick<ViewProps, "style">,
    Pick<PressableTableRowProps, "accessibilityActions" | "accessibilityHint" | "accessibilityLabel" | "accessibilityRole" | "accessibilityState" | "accessible" | "delayLongPress" | "disabled" | "end" | "label" | "onAccessibilityAction" | "onAccessibilityTap" | "onLongPress" | "onPress" | "onPressOut" | "start" | "subLabel" | "trailing" | "variant"> {
    leading?: TableRowProps["icon"];
    leadingStyle?: ViewProps["style"];
    trailingWrapperStyle?: ViewProps["style"];
    DEPRECATED_style?: ViewProps["style"];
    numberOfLines?: TableRowProps["labelLineClamp"];
    activeOpacity?: number | undefined;
    hasError?: boolean | undefined;
}

export interface FormSwitchProps extends Pick<PressableProps, "accessible" | "accessibilityHint" | "accessibilityLabel" | "disabled" | "style"> {
    value?: boolean | undefined;
    onValueChange?: ((value: boolean) => void) | undefined;
    borderColor?: ColorValue | undefined;
    tintColor?: ColorValue | undefined;
    renderIosBackground?: boolean | undefined;
}

export interface FormSwitchRowProps extends Pick<FormLabelProps, "numberOfLines">, Pick<FormSwitchProps, "disabled" | "onValueChange" | "value">, ViewTableRowProps {
    switchProps?: FormSwitchProps | undefined;
}

export const FormSection: ComponentType<FormSection> = TableRowGroup;

export const FormRow: ComponentType<FormRowProps> = TableRow;

export const FormSwitchRow: ComponentType<FormSwitchRowProps> = TableSwitchRow;
