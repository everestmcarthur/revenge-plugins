import React from "react";
import { find, findByName } from "@vendetta/metro";
import { registerIntercept } from "./createElementIntercept";

const TAG = "[ServerDrawer]";

// Used to replace the sidebar with a single DMs icon in its place; DMs now live in the drawer's
// own grid (as the first tile) instead, so the rail just goes away entirely.
function EmptyGuildsBar() {
    return null;
}

function findGuildsBar(): any {
    const byName = findByName("GuildsBar");
    if (byName) return { default: byName };

    let mod = find((m) => {
        try { return m?.default?.type?.name === "GuildsBar"; } catch { return false; }
    });
    if (mod?.default) return mod;

    mod = find((m) => {
        try { return m?.default?.displayName === "GuildsBar"; } catch { return false; }
    });
    if (mod?.default) return mod;

    return null;
}

export function patchHideGuildsBar(cleanups: (() => void)[]): boolean {
    const mod = findGuildsBar();
    if (!mod?.default) {
        console.log(TAG, "WARN: GuildsBar not found");
        return false;
    }
    const orig = mod.default;

    registerIntercept(orig, EmptyGuildsBar);

    mod.default = function HiddenGuildsBar() {
        return React.createElement(EmptyGuildsBar);
    };
    mod.default.displayName = "GuildsBar";
    cleanups.push(() => { mod.default = orig; });
    return true;
}
