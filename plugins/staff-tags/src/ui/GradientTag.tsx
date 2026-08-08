import { React, ReactNative } from "@vendetta/metro/common";
import { getGradientComponent } from "../lib/gradient";
import { IconDef } from "../lib/icons";
import Icon from "./Icon";

const { View, Text } = ReactNative;

const baseStyle = {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 4,
    overflow: "hidden"
};

interface GradientTagProps {
    text: string;
    textColor: any;
    backgroundColor: string;
    gradientColor?: string;
    icon?: IconDef;
    iconColor?: any;
    style?: any;
}

export default function GradientTag({ text, textColor, backgroundColor, gradientColor, icon, iconColor, style }: GradientTagProps) {
    const textStyle = { color: textColor, fontSize: 11, fontWeight: "700" };
    const Gradient = gradientColor ? getGradientComponent() : null;
    const tagContent = (
        <>
            {icon?.path && <Icon icon={icon} size={12} color={iconColor ?? textColor} style={{ marginRight: text ? 4 : 0 }} />}
            <Text style={textStyle}>{text}</Text>
        </>
    );

    if (Gradient) {
        return (
            <Gradient
                colors={[backgroundColor, gradientColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[baseStyle, style]}
            >
                {tagContent}
            </Gradient>
        );
    }

    return (
        <View style={[baseStyle, { backgroundColor }, style]}>
            {tagContent}
        </View>
    );
}
