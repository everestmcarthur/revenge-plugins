import { findByPropsAll } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

import { ProfileEffectRecord } from "@fpte/lib/records";
import { type ProfileEffect, ProfileEffectStore } from "@fpte/lib/stores";
import { previewUserId } from "@fpte/patches/patchUseProfileTheme";

const useSectionModules = findByPropsAll("NONE_ITEM");

let prevProfileEffects: ProfileEffect[];

let prevSections: Record<string, any>[];

export const patchUseProfileEffectSections = () => useSectionModules.map(
    sectionModule => after("default", sectionModule, (_args: unknown[], origSections: typeof prevSections) => {
        try {
            if (previewUserId && origSections?.[0]?.items) {
                const currProfileEffects = ProfileEffectStore.profileEffects;
                if (prevProfileEffects !== currProfileEffects) {
                    origSections.splice(1);
                    origSections[0]!.items.splice(1);
                    ProfileEffectStore.profileEffects.forEach(effect => {
                        origSections[0]!.items.push(new ProfileEffectRecord(effect));
                    });
                    prevSections = origSections;
                } else if (prevSections) {
                    origSections = prevSections;
                }
            }
        } catch {
            // A broken section rewrite shouldn't crash the whole effect-browsing screen - let
            // Discord's own sections render unmodified instead.
        }
        return origSections;
    })
);
