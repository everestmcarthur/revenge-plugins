import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRing from "./patches/ringPatch";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        // Force-disabled this release (not just `??=`, since storage.enabled is already persisted as
        // true on devices that had the previous version) - the size+childCount whitelist added for
        // YouBar/profile/DM-list coverage turned out to also false-positive on guild icons in the
        // server list sidebar (confirmed on-device: every guild icon got painted with a ring). Will
        // stop force-disabling once a live capture pins down what actually distinguishes a real
        // user-presence wrapper from a guild-icon wrapper that happens to share the same shape.
        if (storage.forceDisabledV2 !== true) {
            storage.enabled = false;
            storage.forceDisabledV2 = true;
        }
        storage.colors ??= {
            online: "#23A55A",
            idle: "#F0B232",
            dnd: "#F23F42"
        };
        storage.ringMult ??= 1.3;
        storage.ringThickness ??= 2.5;

        unpatchAll = applyPatches("Radial Status", logger, {
            ring: patchRing
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
