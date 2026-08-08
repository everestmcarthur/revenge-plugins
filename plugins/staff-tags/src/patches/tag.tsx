import { React, ReactNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import Icon from "../ui/Icon";

const Tag = findByProps("getBotLabel");
const { View, Text } = ReactNative;

/**
 * Discord's own Tag component ignores custom text/color props unless we push them into the
 * already-rendered tree ourselves - this is what actually makes our overrides visible. Now also
 * supports an `icon` prop (an IconDef from our icon library) and `iconColor` so tags can render
 * with or without text.
 */
export default () => {
    if (!Tag) return () => {};

    return after("default", Tag, ([{ text, textColor, backgroundColor, icon, iconColor }], ret) => {
        const label = findInReactTree(ret, (c) => typeof c?.props?.children === "string");
        if (!label) return;

        if (text != null) label.props.children = text;
        if (textColor) label.props.style?.push?.({ color: textColor });
        if (backgroundColor) ret?.props?.style?.push?.({ backgroundColor });

        if (icon?.path) {
            const style = label.props.style ?? {};
            ret.props.children = (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Icon icon={icon} size={12} color={iconColor ?? textColor} style={{ marginRight: text ? 4 : 0 }} />
                    <Text style={style}>{text != null ? text : label.props.children}</Text>
                </View>
            );
        }
    });
};
