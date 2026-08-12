import { React, ReactNative } from "@vendetta/metro/common";
import { resolveSemanticColorSafe } from "../lib/color";

const { View, Text } = ReactNative;

/** Small bordered callout for explanatory text in a settings screen. */
export default function NoteBox({ children, style }: { children: any; style?: any }) {
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT", "TEXT_MUTED"], "#96989d");

    return (
        <View
            style={[
                {
                    marginHorizontal: 16,
                    marginVertical: 8,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(128,128,128,0.25)"
                },
                style
            ]}
        >
            <Text style={{ fontSize: 12.5, lineHeight: 18, opacity: 0.75, color: textColor }}>{children}</Text>
        </View>
    );
}
