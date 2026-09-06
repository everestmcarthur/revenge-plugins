import { storage, id } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { stopPlugin } from "@vendetta/plugins";
import { showToast } from "@vendetta/ui/toasts";
import { makeDefaults } from "@shared/lib/utility";
import { enforceBlacklistOnLoad } from "@shared/lib/blacklist";

import { patchFluxDispatch } from "./patches/fluxDispatch";
import { patchUpdateRows } from "./patches/updateRows";
import { patchActionSheet } from "./patches/actionSheet";
import { patchSelfEdit } from "./patches/selfEdit";
import { patchContextMenu } from "./patches/contextMenu";
import { patchMessageRecord } from "./patches/messageRecord";
import Settings from "./ui/Settings";
import type { AntiedStorage } from "./lib/types";

const ChannelMessages = findByProps("_channelMessages");

const isEnabledRef = { current: false };
const deletedMessageMap = new Map<string, any>();
const cleanups: (() => void)[] = [];
let intervalPurge: any = null;

const KEEP_NEWEST = 10;
const DELETE_EACH_CYCLE = 140;

function initStorage() {
    makeDefaults(storage, {
        setting: {
            colorpick: false,
            customize: false,
            ingorelist: false,
            patches: false,
            text: false,
            timestamp: false,
        },
        switches: {
            customizeable: false,
            enableMD: true,
            enableMU: true,
            useBackgroundColor: false,
            useSemRawColors: false,
            ignoreBots: false,
            ignoreOwnMessages: false,
            minimalistic: true,
            alwaysAdd: false,
            darkMode: true,
            removeDismissButton: false,
            addTimestampForEdits: false,
            timestampStyle: "R",
            useEphemeralForDeleted: true,
            overrideIndicator: false,
            useIndicatorForDeleted: false,
            useCustomPluginName: false,
        },
        colors: {
            textColor: "#E40303",
            backgroundColor: "#FF2C2F",
            backgroundColorAlpha: "33",
            gutterColor: "#FF2C2F",
            gutterColorAlpha: "CC",
            semRawColorPrefix: "semanticColors.TEXT_BRAND",
        },
        inputs: {
            deletedMessageBuffer: "This message is deleted",
            editedMessageBuffer: "`[ EDITED ]`",
            historyToast: "[ANTI ED] History Removed",
            ignoredUserList: [],
            customPluginName: "ANTIED",
            customIndicator: "",
        },
        misc: {
            timestampPos: "BEFORE",
            editHistoryIcon: "ic_edit_24px",
        },
        debug: false,
        debugUpdateRows: false,
    });
}

export default {
    onLoad: async () => {
        initStorage();

        if (enforceBlacklistOnLoad(id)) return;

        isEnabledRef.current = true;

        try {
            cleanups.push(patchMessageRecord(isEnabledRef));
            cleanups.push(patchFluxDispatch(deletedMessageMap, isEnabledRef));
            cleanups.push(patchUpdateRows(deletedMessageMap, isEnabledRef));
            cleanups.push(patchActionSheet(deletedMessageMap, isEnabledRef));
            cleanups.push(patchSelfEdit(isEnabledRef));
            cleanups.push(patchContextMenu(isEnabledRef));
        } catch (err) {
            console.error("[ANTIED] Crash on load:", err);
            showToast("[ANTIED] Failed to load patches. Check debug log.");
            stopPlugin(id);
            return;
        }

        intervalPurge = setInterval(() => {
            if (deletedMessageMap.size <= KEEP_NEWEST) return;
            const toDelete = Math.min(DELETE_EACH_CYCLE, deletedMessageMap.size - KEEP_NEWEST);
            let i = 0;
            for (const key of deletedMessageMap.keys()) {
                deletedMessageMap.delete(key);
                if (++i >= toDelete) break;
            }
        }, 15 * 60 * 1000);
    },

    onUnload: () => {
        isEnabledRef.current = false;
        if (intervalPurge) clearInterval(intervalPurge);

        for (const fn of cleanups) {
            try {
                fn();
            } catch (_) {}
        }
        cleanups.length = 0;

        // Revert faked messages
        if (ChannelMessages?._channelMessages) {
            for (const channelId in ChannelMessages._channelMessages) {
                const arr = ChannelMessages._channelMessages[channelId]?._array;
                if (!Array.isArray(arr)) continue;
                for (const message of arr) {
                    if (message?.was_deleted) {
                        FluxDispatcher.dispatch({
                            type: "MESSAGE_DELETE",
                            id: message.id,
                            channelId: message.channel_id || channelId,
                            otherPluginBypass: true,
                        });
                    }
                }
            }
        }

        deletedMessageMap.clear();
    },

    settings: Settings,
};
