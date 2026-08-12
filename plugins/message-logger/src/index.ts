import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import Settings from "./ui/Settings";
import { patchFluxIntercept, revertFakedMessages } from "./patches/fluxIntercept";
import { patchRowStyling } from "./patches/rowStyling";

const TAG = "[MessageLogger]";
const cleanups: (() => void)[] = [];

function initStorage() {
    storage.options ??= {};
    const o = storage.options;
    o.logDeleted ??= true;
    o.keepDeletedInline ??= true;
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

        let patched = 0;
        if (patchFluxIntercept(cleanups)) patched++;
        if (patchRowStyling(cleanups)) patched++;

        console.log(TAG, `onLoad done - ${patched}/2 patches applied`);
    },
    onUnload() {
        console.log(TAG, "onUnload");
        try {
            revertFakedMessages();
        } catch (e: any) {
            logger.error("[MessageLogger] Failed to revert faked messages:", e?.message ?? e);
        }
        for (const fn of cleanups) fn();
        cleanups.length = 0;
    },
    settings: Settings,
};
