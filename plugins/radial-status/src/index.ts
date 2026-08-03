import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { applyPatches } from "@shared/lib/patcher";
import patchRing from "./patches/ringPatch";
import Settings from "./ui/Settings";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        // The previous release's force-disable (storage.forceDisabledV2) was based on a misdiagnosis -
        // what looked like a guild-icon false positive was actually the DM list rendering correctly.
        // The real issue was the size-multiplier growth model being disproportionate on larger avatars
        // (confirmed on-device: "way too big" on YouBar) - fixed in ringPatch.ts by switching to a
        // fixed-px additive growth instead of a percentage multiplier. Force re-enabling once now that
        // the actual defect is fixed, superseding the old force-disable flag.
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
