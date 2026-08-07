import React from "react";
import { View } from "react-native";
import { registerTypeDetector, registerIntercept } from "../lib/createElementIntercept";
import { captureFiberRef } from "../lib/fiberCapture";

const TAG = "[ServerDrawer]";

// Whether this capture point actually mounts depends entirely on whether the intercept below
// fires (unverified independently of it - see lib/fiberCapture.ts for the primary, confirmed
// capture point inside ServerDrawerSheet.tsx itself, which is guaranteed to mount whenever the
// drawer is visibly showing). Kept here too as a second chance, harmless either way.
function Nothing() {
    return React.createElement(View, {
        ref: captureFiberRef,
        style: { width: 1, height: 1 },
    });
}

// Confirmed live (Key Inspector's fiber capture): the parent creates GuildsBar via its OUTER
// React.memo wrapper object ($$typeof: Symbol(react.memo)), which has no own .name/.displayName at
// all - those only exist on the memo's inner function, at type.type.name/type.type.displayName.
// Checking only the outer two (as the first version of this file did) never matches anything,
// which is why the intercept never fired despite the underlying mechanism being sound.
function isGuildsBar(type: any): boolean {
    return type?.name === "GuildsBar" || type?.displayName === "GuildsBar" ||
        type?.type?.name === "GuildsBar" || type?.type?.displayName === "GuildsBar";
}

/**
 * Reset after live, on-device verification (Key Inspector's fiber capture + Eval) disproved the
 * previous approach's own premise. That version assumed GuildsBar had no discoverable runtime name
 * and hid it via a literal nativeID prop instead - but a direct fiber-tree walk found the live,
 * currently-mounted component's name is genuinely "GuildsBar" (tag 15, SimpleMemoComponent, single
 * `enableHome` prop). The real bug: Metro-search-based lookups (rawFindByTypeName("GuildsBar")) DO
 * find *something* by that name, but it's a different, unrelated module - confirmed by comparing
 * the metro-search result against the live fiber's own `.type` by reference, which do not match.
 * That's exactly the kind of silent wrong-match this whole repo has been burned by before.
 *
 * Also confirmed live: GuildsBar genuinely re-renders on normal usage (switching servers - 2 calls
 * counted over a 15s window of real navigation), unlike YouBar's frozen-after-mount leaf. So unlike
 * that investigation, there's no structural reason a straightforward patch can't work here - the
 * only problem was ever finding the *correct* reference.
 *
 * registerTypeDetector sidesteps the module-registry name collision entirely: it inspects the
 * `type` argument passed directly to createElement/jsx at the moment something actually creates an
 * element with it, which is necessarily the real, live reference - there's nothing else it could be.
 * Once caught, registerIntercept registers that *exact* reference (matched by identity, not name)
 * so every future creation of it - which happens on every re-render of GuildsBar's parent, i.e.
 * whenever the rail would normally repaint - renders nothing instead.
 */
export function patchHideGuildsBar(cleanups: (() => void)[]): boolean {
    registerTypeDetector(isGuildsBar, (realGuildsBar) => {
        registerIntercept(realGuildsBar, Nothing);
        console.log(TAG, "PATCH: found a real GuildsBar reference, now rendering nothing");
    }, { persistent: true });
    cleanups.push(() => {
        // No per-call unregister needed - the whole detector/intercept state gets cleared when
        // createElementIntercept's own patch unwinds, part of the same cleanup pass this plugin
        // already runs on unload/restart.
    });
    console.log(TAG, "PATCH: watching for the real GuildsBar to appear");
    return true;
}
