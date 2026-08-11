import { registerPropsTransform } from "./createElementIntercept";

const TAG = "[ServerDrawer]";

// Confirmed live: the quest dock's outer "island" wrapper - a ReanimatedView ten levels above the
// drawer's own grid - carries this exact opaque card background via useAnimatedStyle. It's not
// anything our own code renders, so there's no component reference to intercept - matching the
// static part of its computed style is the only way to reach it.
function flatten(style: any): Record<string, any> {
    if (!style) return {};
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
    return style;
}

function isQuestDockCard(props: any): boolean {
    const s = flatten(props?.style);
    return s.backgroundColor === "rgba(10,10,14,1)" && s.borderRadius === 24;
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
