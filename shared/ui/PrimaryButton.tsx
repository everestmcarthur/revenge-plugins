import { React, ReactNative } from "@vendetta/metro/common";

const { TouchableOpacity, Text } = ReactNative;

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    style?: any;
}

export default function PrimaryButton({ label, onPress, disabled, style }: PrimaryButtonProps) {
    return (
        <TouchableOpacity
            disabled={disabled}
            onPress={onPress}
            style={[
                {
                    backgroundColor: "#5865F2",
                    borderRadius: 8,
                    padding: 10,
                    alignItems: "center",
                    opacity: disabled ? 0.5 : 1
                },
                style
            ]}
        >
            <Text style={{ color: "white", fontWeight: "600" }}>{label}</Text>
        </TouchableOpacity>
    );
}
