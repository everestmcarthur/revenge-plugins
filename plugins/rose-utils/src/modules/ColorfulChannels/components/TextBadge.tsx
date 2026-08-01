import { React, ReactNative } from "@vendetta/metro/common";

const { View, Text } = ReactNative;

const VARIANTS: Record<string, { bg: string; fg: string }> = {
    destructive: { bg: "#F23F42", fg: "#FFFFFF" },
    default: { bg: "#4E5058", fg: "#FFFFFF" },
};

export default function TextBadge({ variant = "default", children }: { variant?: string; children: any }) {
    const colors = VARIANTS[variant] ?? VARIANTS.default;

    return (
        <View style={{ backgroundColor: colors.bg, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4, alignSelf: "center" }}>
            <Text style={{ color: colors.fg, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{children}</Text>
        </View>
    );
}
