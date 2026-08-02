import { lazy } from "./lazy";
import { rawFindByFunctionProps, rawFindByValidProps } from "./rawFind";

/**
 * Confirmed live (Key Inspector's Eval console, full window.modules scan): a single decoy module
 * matches dozens of common hook/utility property names at once - useStateFromStores,
 * triggerHapticFeedback, colors, transitionToGuild, bulkAck, and more - all with non-function/
 * placeholder values (a type-shape/declaration-style object, not real code). Since window.modules
 * iterates in ascending numeric id order and this decoy has a lower id than every real
 * implementation it collides with, a plain "does this property exist" check
 * (findByProps/rawFindByProps) reliably matches the decoy instead of the real thing - every single
 * time, not occasionally. This is what made tapping a server, marking as read, and haptics all
 * silently no-op even after this repo's own retry-loop fixes.
 *
 * rawFindByFunctionProps requires the matched property to actually be a function, which the decoy's
 * isn't. Enum/object-shaped properties (which the decoy also fakes) need rawFindByValidProps
 * instead, checking for a real value the decoy doesn't have.
 *
 * Centralized here because every component in this plugin independently needed the same handful of
 * lookups - keeping one copy means the decoy-avoidance logic can't drift out of sync across files.
 */
export const getFlux = lazy(() => rawFindByFunctionProps<any>("useStateFromStores"));

export const getHaptic = lazy(() => rawFindByValidProps<any>({
    triggerHapticFeedback: (v) => typeof v === "function",
    HapticFeedbackTypes: (v) => v?.SOFT !== undefined,
}));

/** Has both `.colors` (semantic tokens like TEXT_NORMAL/BG_ACCENT) and `.unsafe_rawColors` (raw palette like WHITE/GREEN_360) on the same module. */
export const getColorModule = lazy(() => rawFindByValidProps<any>({
    colors: (v) => v?.BG_ACCENT !== undefined,
    unsafe_rawColors: (v) => v?.WHITE !== undefined,
}));

export const getBulkAckMod = lazy(() => rawFindByFunctionProps<any>("bulkAck", "ackChannel"));

export const getReadStateTypesMod = lazy(() => rawFindByValidProps<any>({
    ReadStateTypes: (v) => v?.CHANNEL !== undefined,
    UnreadSetting: (v) => v?.ALL_MESSAGES !== undefined,
}));
