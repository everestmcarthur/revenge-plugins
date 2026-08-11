import { find, findByName } from "@vendetta/metro";
import { registerIntercept } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

function Nothing() {
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

    registerIntercept(orig, Nothing);

    mod.default = function HiddenGuildsBar() {
        return null;
    };
    mod.default.displayName = "GuildsBar";
    cleanups.push(() => { mod.default = orig; });
    return true;
}
