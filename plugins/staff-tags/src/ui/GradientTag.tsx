import { React, ReactNative } from "@vendetta/metro/common";
import { getGradientComponent } from "../lib/gradient";

const { View, Text } = ReactNative;

const baseStyle = {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 4,
    marginLeft: 4,
    overflow: "hidden"
};

interface GradientTagProps {
    text: string;
    textColor: any;
    backgroundColor: string;
    gradientColor?: string;
    style?: any;
}

export default function GradientTag({ text, textColor, backgroundColor, gradientColor, style }: GradientTagProps) {
    const textStyle = { color: textColor, fontSize: 11, fontWeight: "700" };
    const Gradient = gradientColor ? getGradientComponent() : null;

    if (Gradient) {
        return (
            <Gradient
                colors={[backgroundColor, gradientColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[baseStyle, style]}
            >
                <Text style={textStyle}>{text}</Text>
            </Gradient>
        );
    }

    return (
        <View style={[baseStyle, { backgroundColor }, style]}>
            <Text style={textStyle}>{text}</Text>
        </View>
    );
}
