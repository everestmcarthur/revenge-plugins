import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";

const Tag = findByProps("getBotLabel");

/**
 * Discord's own Tag component ignores custom text/color props unless we push them into the
 * already-rendered tree ourselves - this is what actually makes our overrides visible.
 */
export default () => {
    if (!Tag) return () => {};

    return after("default", Tag, ([{ text, textColor, backgroundColor }], ret) => {
        const label = findInReactTree(ret, (c) => typeof c?.props?.children === "string");
        if (!label) return;

        if (text) label.props.children = text;
        if (textColor) label.props.style?.push?.({ color: textColor });
        if (backgroundColor) ret?.props?.style?.push?.({ backgroundColor });
    });
};
