import { id } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { stopPlugin } from "@vendetta/plugins";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";

import { patchFluxDispatch } from "./patches/fluxDispatch";
import { patchActionSheet } from "./patches/actionSheet";
import { patchSelfEdit } from "./patches/selfEdit";
import Settings from "./ui/Settings";

const isEnabledRef = { current: false };
const deletedMessageMap = new Map<string, any>();
const cleanups: (() => void)[] = [];

export default {
    onLoad: async () => {
        if (enforceBlacklistOnLoad(id)) return;

        isEnabledRef.current = true;

        try {
            cleanups.push(patchFluxDispatch(deletedMessageMap, isEnabledRef));
            cleanups.push(patchActionSheet(isEnabledRef));
            cleanups.push(patchSelfEdit(isEnabledRef));
        } catch (err) {
            console.error("[ANTIED ZERO] Crash on load:", err);
            showToast("[ANTIED ZERO] Failed to load. Check debug log.");
            stopPlugin(id);
        }
    },

    onUnload: () => {
        isEnabledRef.current = false;

        for (const fn of cleanups) {
            try {
                fn();
            } catch (_) {}
        }
        cleanups.length = 0;
        deletedMessageMap.clear();
    },

    settings: Settings,
};
