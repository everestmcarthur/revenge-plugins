import { registerPropsTransform } from "./createElementIntercept";

const TAG = "[ServerDrawer]";

// Confirmed live: the quest dock's outer "island" wrapper - a ReanimatedView ten levels above the
// drawer's own grid - carries an opaque card background (borderRadius: 24) via useAnimatedStyle.
// It's not anything our own code renders, so there's no component reference to intercept - matching
// the static part of its computed style is the only way to reach it. The color itself showed up as
// two different string formats (rgba(...) vs hex) across two live reads of the same element, so
// matching on the exact color string is unreliable - borderRadius plus "has some background color
// at all" is the stable signal.
function flatten(style: any): Record<string, any> {
    if (!style) return {};
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
    return style;
}

function isQuestDockCard(props: any): boolean {
    const s = flatten(props?.style);
    return s.borderRadius === 24 && typeof s.backgroundColor === "string";
}

export function patchTransparentBackground(cleanups: (() => void)[]): boolean {
    registerPropsTransform(
        (props: any) => isQuestDockCard(props),
        (props: any) => ({
            ...props,
            style: [props?.style, { backgroundColor: "transparent" }],
        }),
    );
    console.log(TAG, "PATCH: watching for the quest dock card background");
    return true;
}
