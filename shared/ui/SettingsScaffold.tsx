import { React, ReactNative } from "@vendetta/metro/common";

const { ScrollView, View } = ReactNative;

/** Consistent wrapper for every plugin's settings screen: scroll view + bottom breathing room. */
export default function SettingsScaffold({ children }: { children: any }) {
    return (
        <ScrollView style={{ flex: 1 }}>
            {children}
            <View style={{ height: 24 }} />
        </ScrollView>
    );
}
