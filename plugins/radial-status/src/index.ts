import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRing from "./patches/ringPatch";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        // Force re-enabling once, superseding the old force-disable flag from before the growth
        // model in ringPatch.ts was fixed to additive px instead of a percentage multiplier.
        if (storage.forceReenabledV3 !== true) {
            storage.enabled = true;
            storage.forceReenabledV3 = true;
        }
        storage.colors ??= {
            online: "#23A55A",
            idle: "#F0B232",
            dnd: "#F23F42"
        };
        storage.ringThickness ??= 2;

        unpatchAll = applyPatches("Radial Status", logger, {
            ring: patchRing
        });
    },
    onUnload: () => unpatchAll(),
    settings: Settings
};
