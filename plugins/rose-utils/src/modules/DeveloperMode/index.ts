import { findByProps, findByStoreName } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { fluxSubscribe } from "@shared/lib/flux";
import { Module, ModuleCategory } from "../../lib/Module";
import { registerMessageAction, type MessageActionRow } from "../../lib/messageActionSheet";

// Confirmed against decompiled current-build Discord source: Developer Mode is a proto-backed
// setting exposed as DeveloperMode.getSetting()/updateSetting(bool), part of the same
// modules/user_settings/UserSettings.tsx module that exports every other appearance/advanced
// setting (DarkSidebar, MessageDisplayCompact, etc - all built the same way via defineProtoSetting).
// It resets itself more than it should on Revenge - rather than guess at why, this just re-asserts
// it every time the user's settings proto changes, which is the same event Discord's own settings
// UI reacts to.
const UserSettingsModule = findByProps("DeveloperMode", "DarkSidebar");

// Confirmed live via Key Inspector Eval (/root/eval-for-revenge/ru/activity-payload-capture.txt):
// caught a real LOCAL_ACTIVITY_UPDATE payload while Watch Together was running - the activity
// object is exactly {type, name, application_id, platform, party, secrets, flags, metadata}, snake
// case, matching the primary branch checked below. That capture was for the local user specifically
// (own activities dispatch through a local-first path, which is why PresenceStore.getActivities on
// your own ID came back empty even mid-session) - but it's the same public Gateway Activity object
// schema Discord broadcasts for everyone, which is what PresenceStore caches for *other* users -
// the actual case this code needs, since it looks up the message author, not the local user. Not
// yet caught a live PresenceStore.getActivities(otherUserId) call directly, but the shape match
// leaves nothing left to guess at.
const PresenceStore = findByStoreName("PresenceStore");

// Confirmed live via Key Inspector Eval (/root/eval-for-revenge/ru/all-checks.txt) against real
// slash-command messages: message.interaction is populated with {id, name, type, user,
// displayName} exactly as read below (message.type 20 = CHAT_INPUT_COMMAND on these).
// interactionMetadata/interaction_metadata are checked as a fallback for whichever build doesn't
// populate the legacy .interaction field.
function getCommandInteraction(message: any): { id: string; name?: string } | null {
    const interaction = message?.interaction ?? message?.interactionMetadata ?? message?.interaction_metadata;
    if (!interaction?.id) return null;
    return { id: String(interaction.id), name: interaction.name };
}

function commandIdRows(message: any): MessageActionRow[] {
    const interaction = getCommandInteraction(message);
    if (!interaction) return [];

    return [
        {
            key: "rose-utils-copy-command-id",
            label: "Copy Command ID",
            sublabel: interaction.name ? `/${interaction.name}` : "Slash command interaction",
            icon: "ic_copy_24px",
            onPress: () => {
                clipboard.setString(interaction.id);
                showToast("Copied command ID to clipboard", getAssetIDByName("ic_copy_24px"));
            },
        },
    ];
}

function activityIdRows(message: any): MessageActionRow[] {
    if (!PresenceStore?.getActivities) return [];

    const authorId = message?.author?.id;
    if (!authorId) return [];

    let activities: any[];
    try {
        activities = PresenceStore.getActivities(authorId);
    } catch {
        return [];
    }
    if (!Array.isArray(activities)) return [];

    const withAppId = activities.filter((a) => a?.application_id ?? a?.applicationId);
    if (!withAppId.length) return [];

    return withAppId.map((activity, i) => {
        const appId = String(activity.application_id ?? activity.applicationId);
        return {
            key: `rose-utils-copy-activity-id-${i}`,
            label: withAppId.length > 1 ? `Copy Activity ID (${activity.name ?? i + 1})` : "Copy Activity/Game ID",
            sublabel: activity.name,
            icon: "ic_copy_24px",
            onPress: () => {
                clipboard.setString(appId);
                showToast(`Copied ${activity.name ?? "activity"} ID to clipboard`, getAssetIDByName("ic_copy_24px"));
            },
        };
    });
}

export default new Module({
    id: "enforce-developer-mode",
    label: "Developer Mode",
    meta: {
        sublabel: "Turns on Discord's real Developer Mode (all its native Copy ID options) and adds extra copy-ID tools slash commands and activities don't get natively",
        category: ModuleCategory.Useful,
    },
    settings: {
        keepNativeOn: {
            label: "Keep native Developer Mode on",
            subLabel: "Re-asserts Discord's own Developer Mode setting - it tends to reset itself on Revenge-based clients",
            type: "toggle",
            default: true,
        },
        copyCommandId: {
            label: "Copy Command ID",
            subLabel: "Adds a row to the message long-press menu for messages sent via a slash command",
            type: "toggle",
            default: true,
        },
        copyActivityId: {
            label: "Copy Activity/Game ID",
            subLabel: "Adds a row to the message long-press menu to copy the author's current game/activity application ID (not every activity type has one, e.g. a plain custom status)",
            type: "toggle",
            default: true,
        },
    },
    handlers: {
        onStart() {
            if (this.storage.options.keepNativeOn) {
                const DeveloperMode = UserSettingsModule?.DeveloperMode;
                if (DeveloperMode?.getSetting && DeveloperMode?.updateSetting) {
                    const enforce = () => {
                        try {
                            if (!DeveloperMode.getSetting()) DeveloperMode.updateSetting(true);
                        } catch {
                            // Best-effort - if this particular check throws, the next settings change retries it.
                        }
                    };

                    enforce();
                    this.patches.add(fluxSubscribe("USER_SETTINGS_PROTO_UPDATE", enforce));

                    // Belt and suspenders: if whatever resets this doesn't go through
                    // USER_SETTINGS_PROTO_UPDATE for some reason, this still catches it within 5s
                    // instead of staying off for the rest of the session.
                    const interval = setInterval(enforce, 5000);
                    this.patches.add(() => clearInterval(interval));
                }
            }

            if (this.storage.options.copyCommandId) {
                this.patches.add(registerMessageAction(commandIdRows));
            }

            if (this.storage.options.copyActivityId) {
                this.patches.add(registerMessageAction(activityIdRows));
            }
        },
        onStop() {},
    },
});
