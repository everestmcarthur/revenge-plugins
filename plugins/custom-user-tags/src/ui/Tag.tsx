import { React, ReactNative } from "@vendetta/metro/common";
import { ResolvedTag } from "../lib/resolveTag";
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

interface TagProps {
    tag: ResolvedTag;
    style?: any;
}

export default function CustomTag({ tag, style }: TagProps) {
    return (
        <View style={[baseStyle, { backgroundColor: tag.backgroundColor }, style]}>
            {tag.icon && (tag.icon.path || tag.icon.svg) && <Icon icon={tag.icon} size={12} color={tag.iconColor} style={{ marginRight: tag.text ? 4 : 0 }} />}
            {!!tag.text && <Text style={{ color: tag.textColor, fontSize: 11, fontWeight: "700" }}>{tag.text}</Text>}
        </View>
    );
}
