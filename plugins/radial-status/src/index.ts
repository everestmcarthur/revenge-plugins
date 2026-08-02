import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRing from "./patches/ringPatch";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        // Off by default - see the note in patches/ringPatch.ts. Confirmed on-device to corrupt
        // member list rows and the profile status indicator, and to never match YouBar's own
        // indicator at all - being re-diagnosed properly before this defaults back on.
        storage.enabled ??= false;
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
