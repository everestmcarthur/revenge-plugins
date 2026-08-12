import { React, ReactNative } from "@vendetta/metro/common";
import { isValidHex, resolveSemanticColorSafe } from "../lib/color";

const { View, Text, TextInput, TouchableOpacity } = ReactNative;

const PRESETS = [
    "#F23F42", "#F0B232", "#FEE75C", "#23A55A",
    "#1ABC9C", "#5865F2", "#9B59B6", "#EB459E",
    "#99AAB5", "#FFFFFF"
];

interface ColorInputProps {
    title: string;
    value?: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

// Hex color field with a live swatch preview and tap-to-pick presets. Built entirely from RN
// primitives, so it doesn't carry the same "might silently stop rendering after a Discord update"
// risk as the plugins' UI patches do.
export default function ColorInput({ title, value, placeholder, onChange }: ColorInputProps) {
    const valid = !value || isValidHex(value);
    const swatchColor = isValidHex(value) ? value : (isValidHex(placeholder) ? placeholder : "#5865F2");
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

    return (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        backgroundColor: swatchColor,
                        marginRight: 10,
                        borderWidth: 1,
                        borderColor: "rgba(128,128,128,0.35)"
                    }}
                />
                <Text style={{ fontSize: 15, fontWeight: "600", color: textColor }}>{title}</Text>
            </View>
            <TextInput
                value={value ?? ""}
                placeholder={placeholder ?? "#5865F2"}
                onChangeText={onChange}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="rgba(128,128,128,0.6)"
                style={{
                    borderWidth: 1,
                    borderColor: valid ? "rgba(128,128,128,0.35)" : "#F23F42",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 14,
                    marginBottom: 8,
                    color: textColor
                }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {PRESETS.map((preset) => {
                    const active = value?.toLowerCase() === preset.toLowerCase();
                    return (
                        <TouchableOpacity
                            key={preset}
                            onPress={() => onChange(preset)}
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                backgroundColor: preset,
                                marginRight: 8,
                                marginBottom: 8,
                                borderWidth: active ? 2 : 1,
                                borderColor: active ? "#ffffff" : "rgba(128,128,128,0.35)"
                            }}
                        />
                    );
                })}
            </View>
            {!valid && (
                <Text style={{ color: "#F23F42", marginTop: 2, fontSize: 12 }}>
                    Invalid hex color, e.g. #5865F2
                </Text>
            )}
        </View>
    );
}
