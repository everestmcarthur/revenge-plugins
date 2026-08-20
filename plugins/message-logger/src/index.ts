import { logger } from "@vendetta";
import { id, storage } from "@vendetta/plugin";
import { guardPlugin } from "@shared/lib/guard";
import Settings from "./ui/Settings";
import { patchFluxIntercept, rehydrateFromLog, revertFakedMessages } from "./patches/fluxIntercept";
import { patchRowStyling } from "./patches/rowStyling";
import { initCloudSync } from "./lib/cloudSync";

const TAG = "[MessageLogger]";
let unpatchAll: () => void = () => {};

function initStorage() {
    storage.options ??= {};
    const o = storage.options;
    o.logDeleted ??= true;
    o.keepDeletedInline ??= false;
    o.logEdited ??= true;
    o.ignoreBots ??= false;
    o.ignoreOwnMessages ??= false;
    o.ignoreOwnEdits ??= false;
    o.ignoreDMs ??= false;
    o.ignoredChannelIds ??= "";
    o.ignoredGuildIds ??= "";
    o.ignoredUserIds ??= "";
    o.ignoredKeywords ??= "";
    o.maxEntries ??= "2000";
    o.maxEntriesPerChannel ??= "0";
    o.maxAgeDays ??= "30";
}

export default {
    onLoad() {
        initStorage();
        console.log(TAG, "onLoad");

        unpatchAll = guardPlugin(id, () => {
            const cleanups: (() => void)[] = [];
            let patched = 0;
            if (patchFluxIntercept(cleanups)) patched++;
            if (patchRowStyling(cleanups)) patched++;
            cleanups.push(initCloudSync());
            rehydrateFromLog();

            console.log(TAG, `onLoad done - ${patched}/2 patches applied`);
            return () => {
                for (const fn of cleanups) fn();
                cleanups.length = 0;
            };
        });
    },
    onUnload() {
        console.log(TAG, "onUnload");
        try {
            revertFakedMessages();
        } catch (e: any) {
            logger.error("[MessageLogger] Failed to revert faked messages:", e?.message ?? e);
        }
        unpatchAll();
    },
    settings: Settings,
};
