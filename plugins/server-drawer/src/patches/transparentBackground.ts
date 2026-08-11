import { registerPropsTransform, registerPropsIntercept } from "./createElementIntercept";

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

// Removing the card's own color only revealed a second, separate layer underneath: the quest's own
// promotional hero photo, rendered as a real <FastImageAndroid> pointed at a discordapp.com/quests/
// URL - confirmed live (an actual promo image showed through once the color was gone). Matching by
// URL shape, not by component, since the same image component renders ordinary guild/folder icons
// everywhere else in the app too.
function getSourceUri(props: any): string | undefined {
    const source = props?.source;
    if (!source) return undefined;
    if (Array.isArray(source)) return source[0]?.uri;
    return source.uri;
}

function isQuestHeroImage(props: any): boolean {
    const uri = getSourceUri(props);
    return typeof uri === "string" && uri.includes("/quests/");
}

export function patchTransparentBackground(cleanups: (() => void)[]): boolean {
    registerPropsTransform(
        (props: any) => isQuestDockCard(props),
        (props: any) => ({
            ...props,
            style: [props?.style, { backgroundColor: "transparent" }],
        }),
    );
    registerPropsIntercept(isQuestHeroImage, null);
    console.log(TAG, "PATCH: watching for the quest dock card background and hero image");
    return true;
}
