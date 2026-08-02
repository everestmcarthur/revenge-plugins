import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRing from "./patches/ringPatch";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
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
