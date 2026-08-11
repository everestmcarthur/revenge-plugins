import React from "react";
import { View } from "react-native";
import { registerPropsTransform, registerTypeDetector, registerIntercept } from "../lib/createElementIntercept";
import { captureFiberRef } from "../lib/fiberCapture";

const TAG = "[ServerDrawer]";
const SD_NOTHING_TEST_ID = "ServerDrawerNothing";

function Nothing() {
    return React.createElement(View, {
        ref: captureFiberRef,
        style: {
            display: "none",
            width: 0,
            minWidth: 0,
            maxWidth: 0,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: 0,
            margin: 0,
            padding: 0,
            borderWidth: 0,
            overflow: "hidden",
        },
    });
}

// Confirmed live (Key Inspector's fiber capture): the parent creates GuildsBar via its OUTER
// React.memo wrapper object, which has no own .name/.displayName at all - those only exist on the
// memo's inner function, at type.type.name/type.type.displayName.
function isGuildsBar(type: any): boolean {
    return type?.name === "GuildsBar" || type?.displayName === "GuildsBar" ||
        type?.type?.name === "GuildsBar" || type?.type?.displayName === "GuildsBar";
}

function hasChildWithTestID(children: any, rest: any[], testID: string): boolean {
    const inspect = (child: any) => child != null && typeof child === "object" && child.props?.testID === testID;
    if (children != null) {
        if (Array.isArray(children)) { if (children.some(inspect)) return true; }
        else if (inspect(children)) return true;
    }
    for (const child of rest) if (inspect(child)) return true;
    return false;
}

export function patchHideGuildsBar(cleanups: (() => void)[]): boolean {
    // Hard-enforce the GuildsBar parent's visibility by detecting the hidden Nothing child and
    // zeroing the rail wrapper itself. Confirmed live that the immediate parent carries an
    // explicit width: 72 in its own style, so display: none alone left the space reserved -
    // zeroing width/flex directly, the same way collapseAncestors does further up, actually
    // reclaims it.
    registerPropsTransform(
        (props: any, _type: any, rest: any[]) =>
            hasChildWithTestID(props?.children, rest, SD_NOTHING_TEST_ID),
        (props: any) => ({
            ...props,
            style: [
                props?.style,
                {
                    display: "none",
                    width: 0,
                    minWidth: 0,
                    maxWidth: 0,
                    flexGrow: 0,
                    flexShrink: 0,
                    flexBasis: 0,
                    margin: 0,
                    padding: 0,
                    borderWidth: 0,
                    overflow: "hidden",
                },
            ],
        }),
    );

    registerTypeDetector("ServerDrawer.HideGuildsBar", isGuildsBar, (realGuildsBar) => {
        registerIntercept(realGuildsBar, Nothing, { testID: SD_NOTHING_TEST_ID }, { collapseAncestors: 6 });
        console.log(TAG, "PATCH: found a real GuildsBar reference, now rendering nothing");
    }, { persistent: true });
    cleanups.push(() => {
        // No per-call unregister needed - createElementIntercept clears all transforms/intercepts
        // together when its own patch unwinds.
    });
    console.log(TAG, "PATCH: watching for the real GuildsBar to appear");
    return true;
}
