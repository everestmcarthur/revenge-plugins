import React from "react";

import { FluxDispatcher } from "@fpte/lib/flux";
import { type ProfileEffectConfig, getProfileEffectStore, UserStore } from "@fpte/lib/stores";
import { setPreviewUserId } from "@fpte/patches/patchUseProfileTheme";
import { EffectPickerActionSheet, hideActionSheet, showActionSheet } from "@fpte/ui/actionSheets";

const SHEET_KEY = "__FPTE__";

export function showEffectPicker(
    onSelect: (effect: ProfileEffectConfig | null) => void,
    currentEffectId?: string | undefined
) {
    // Called directly from a native onPress - an uncaught throw here is fatal to the whole app
    // (surfaces as AndroidRuntime FATAL EXCEPTION, not a recoverable React error screen).
    try {
        const user = UserStore.getCurrentUser();
        const profileEffectStore = getProfileEffectStore();
        if (!user || !profileEffectStore) return;

        function onClose(action: any) {
            if (action.key === SHEET_KEY) {
                FluxDispatcher.unsubscribe("HIDE_ACTION_SHEET", onClose);
                setPreviewUserId(undefined);
            }
        }
        FluxDispatcher.subscribe("HIDE_ACTION_SHEET", onClose);

        showActionSheet({
            content: (
                <EffectPickerActionSheet
                    effects={profileEffectStore.profileEffects}
                    onSelect={effect => {
                        onSelect(effect);
                        hideActionSheet(SHEET_KEY);
                    }}
                    user={user}
                    currentEffectId={currentEffectId}
                />
            ),
            key: SHEET_KEY
        });
    } catch {
        // Nothing sensible to fall back to for a picker that couldn't even open - just don't
        // crash the app over it.
    }
}
