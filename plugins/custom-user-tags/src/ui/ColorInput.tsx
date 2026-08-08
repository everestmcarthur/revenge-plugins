import { React, ReactNative } from "@vendetta/metro/common";
import { isValidHex, normalizeHex } from "@shared/lib/color";
import { resolveSemanticColorSafe } from "@shared/lib/color";

const { View, Text, TextInput, TouchableOpacity } = ReactNative;

interface ColorInputProps {
    title: string;
    value?: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

const PRESETS = [
    "#F23F42", "#F0B232", "#FEE75C", "#23A55A",
    "#1ABC9C", "#5865F2", "#9B59B6", "#EB459E",
    "#99AAB5", "#FFFFFF",
    "#FF6B6B", "#FF9F43", "#FDCB6E", "#00B894",
    "#00CEC9", "#0984E3", "#6C5CE7", "#FD79A8",
    "#A29BFE", "#DFE6E9", "#636E72", "#2D3436",
    "#E17055", "#D63031", "#74B9FF", "#A8E6CF",
    "#FDFFAB", "#FFB7B2", "#FF8B94", "#C7CEEA",
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#00FFFF", "#FF00FF", "#000000", "#808080"
];

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
    const full = normalizeHex(hex).slice(1);
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16)
    ];
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((n) => clamp(n, 0, 255).toString(16).padStart(2, "0")).join("");
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rainbow(count: number): string[] {
    return Array.from({ length: count }, (_, i) => rgbToHex(...hsvToRgb((i * 360) / count, 1, 1)));
}

function shades(base: string, count: number): string[] {
    const [h, s, v] = rgbToHsv(...hexToRgb(base));
    return Array.from({ length: count }, (_, i) => rgbToHex(...hsvToRgb(h, s, 0.2 + (0.8 * i) / (count - 1))));
}

function randomHex(): string {
    return rgbToHex(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
}

export default function ColorInput({ title, value, placeholder, onChange }: ColorInputProps) {
    const normalized = value ? normalizeHex(value) : "";
    const valid = !value || isValidHex(value);
    const swatchColor = isValidHex(value) ? normalized : (isValidHex(placeholder) ? normalizeHex(placeholder) : "#5865F2");
    const [r, g, b] = hexToRgb(swatchColor);
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

    const updateHex = (text: string) => {
        const t = text.trim().toLowerCase();
        if (!t) {
            onChange("");
            return;
        }
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) {
            onChange(t.toUpperCase());
        } else {
            onChange(text);
        }
    };

    const updateRgb = (component: "r" | "g" | "b", raw: string) => {
        const num = parseInt(raw, 10);
        if (Number.isNaN(num)) return;
        const next = [r, g, b];
        if (component === "r") next[0] = num;
        else if (component === "g") next[1] = num;
        else next[2] = num;
        onChange(rgbToHex(...next as [number, number, number]));
    };

    const hueColors = rainbow(12);
    const shadeColors = shades(swatchColor, 6);

    return (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View
                    style={{
                        width: 28,
                        height: 28,
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
                onChangeText={updateHex}
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
                    marginBottom: 6,
                    color: textColor
                }}
            />

            {valid && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    {(["r", "g", "b"] as const).map((c, i) => (
                        <View key={c} style={{ flex: 1, marginHorizontal: c === "g" ? 8 : 0 }}>
                            <Text style={{ fontSize: 11, color: textColor, opacity: 0.7, textTransform: "uppercase", marginBottom: 2 }}>{c}</Text>
                            <TextInput
                                value={String([r, g, b][i])}
                                keyboardType="numeric"
                                onChangeText={(v: string) => updateRgb(c, v)}
                                style={{
                                    borderWidth: 1,
                                    borderColor: "rgba(128,128,128,0.35)",
                                    borderRadius: 6,
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    fontSize: 13,
                                    color: textColor
                                }}
                            />
                        </View>
                    ))}
                </View>
            )}

            {valid && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
                    {shadeColors.map((color) => (
                        <TouchableOpacity
                            key={color}
                            onPress={() => onChange(color.toUpperCase())}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: color,
                                marginRight: 6,
                                marginBottom: 6,
                                borderWidth: value?.toLowerCase() === color.toLowerCase() ? 2 : 1,
                                borderColor: value?.toLowerCase() === color.toLowerCase() ? "#ffffff" : "rgba(128,128,128,0.35)"
                            }}
                        />
                    ))}
                </View>
            )}

            {valid && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
                    {hueColors.map((color) => (
                        <TouchableOpacity
                            key={color}
                            onPress={() => onChange(color.toUpperCase())}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: color,
                                marginRight: 6,
                                marginBottom: 6,
                                borderWidth: value?.toLowerCase() === color.toLowerCase() ? 2 : 1,
                                borderColor: value?.toLowerCase() === color.toLowerCase() ? "#ffffff" : "rgba(128,128,128,0.35)"
                            }}
                        />
                    ))}
                </View>
            )}

            <TouchableOpacity
                onPress={() => onChange(randomHex())}
                style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: "rgba(88,101,242,0.2)",
                    alignItems: "center",
                    marginBottom: 8
                }}
            >
                <Text style={{ color: "#5865F2", fontWeight: "600" }}>Random color</Text>
            </TouchableOpacity>

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
