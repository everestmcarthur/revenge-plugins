import { React, ReactNative } from "@vendetta/metro/common";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { ICONS } from "../lib/icons";
import Icon from "./Icon";

const { View, Text, TouchableOpacity, ScrollView } = ReactNative;

interface IconPickerProps {
    title?: string;
    value?: string;
    onChange: (value: string) => void;
    color?: string;
}

export default function IconPicker({ title = "Icon", value, onChange, color = "#5865F2" }: IconPickerProps) {
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");
    const iconColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

    return (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: textColor, marginBottom: 8 }}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row" }}>
                    {ICONS.map((icon) => {
                        const active = value === icon.id;
                        return (
                            <TouchableOpacity
                                key={icon.id}
                                onPress={() => onChange(icon.id)}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 8,
                                    backgroundColor: active ? color : "rgba(128,128,128,0.15)",
                                    borderWidth: active ? 2 : 1,
                                    borderColor: active ? "#ffffff" : "rgba(128,128,128,0.35)"
                                }}
                            >
                                {icon.path ? (
                                    <Icon icon={icon} size={20} color={active ? "#ffffff" : iconColor} />
                                ) : (
                                    <Text style={{ fontSize: 12, color: active ? "#ffffff" : iconColor }}>—</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
            <Text style={{ fontSize: 13, color: textColor, opacity: 0.7 }}>
                {ICONS.find((i) => i.id === value)?.name ?? "No icon"}
            </Text>
        </View>
    );
}
