import { React, ReactNative } from "@vendetta/metro/common";

const { View, Text } = ReactNative;

/** Small bordered callout for explanatory text in a settings screen - theme-agnostic by design. */
export default function NoteBox({ children, style }: { children: any; style?: any }) {
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
            <Text style={{ fontSize: 12.5, lineHeight: 18, opacity: 0.75 }}>{children}</Text>
        </View>
    );
}
