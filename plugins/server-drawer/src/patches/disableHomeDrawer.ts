import { findByProps } from "@vendetta/metro";

const TAG = "[ServerDrawer]";

// Discord's own "2025-10-mobile-home-drawer" experiment: one bucket (landOnHome) force-opens
// a native drawer panel on boot, sliding all content right and exposing whatever normally sits
// behind it - including the guild bar we already hid, but in a spot our own patch never reaches
// since it's a separate reveal, not the guild bar's usual mount. Forcing the control config off
// keeps content pinned in place so nothing gets revealed in the first place.
const DISABLED_CONFIG = { enableHome: false, landOnHome: false, enablePeekHint: false };

export function patchDisableHomeDrawer(cleanups: (() => void)[]): boolean {
    const exp = findByProps("MobileHomeDrawerExperiment")?.MobileHomeDrawerExperiment;
    if (!exp?.useConfig) {
        console.log(TAG, "WARN: MobileHomeDrawerExperiment not found");
        return false;
    }
    const orig = exp.useConfig;
    exp.useConfig = () => DISABLED_CONFIG;
    cleanups.push(() => { exp.useConfig = orig; });
    console.log(TAG, "PATCH: MobileHomeDrawerExperiment forced off");
    return true;
}
