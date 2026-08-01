import { registerPropsIntercept } from "./createElementIntercept";

const TAG = "[ServerDrawer]";

/**
 * The left server rail's root component (modules/guilds_bar/native/GuildsBar.tsx, confirmed
 * against decompiled current-build Discord source) is a bare default export with no named export
 * and no discoverable component name at runtime - findByName("GuildsBar") and every displayName/
 * type.name heuristic reliably comes up empty because there's genuinely nothing to match by name.
 * What IS reliable: the outermost View it renders is built with a literal, unminifiable
 * `nativeID: "guilds-bar-view"` (confirmed unique - it appears exactly once in the whole decompiled
 * bundle). Intercepting createElement calls carrying that prop and rendering nothing instead is a
 * stable way to hide it regardless of what the component itself is named at runtime.
 */
export function patchHideGuildsBar(cleanups: (() => void)[]): boolean {
    registerPropsIntercept((props) => props?.nativeID === "guilds-bar-view", null);
    cleanups.push(() => {
        // registerPropsIntercept has no per-call unregister - the whole list gets cleared when
        // createElementIntercept's own patch unwinds, which happens as part of the same cleanup
        // pass this plugin already runs on unload/restart.
    });
    console.log(TAG, "PATCH: guilds-bar-view createElement calls now render nothing");
    return true;
}
