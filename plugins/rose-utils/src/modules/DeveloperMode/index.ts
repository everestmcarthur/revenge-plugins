import { findByProps, findByStoreName } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { fluxSubscribe } from "@shared/lib/flux";
import { Module, ModuleCategory } from "../../lib/Module";
import { registerMessageAction, type MessageActionRow } from "../../lib/messageActionSheet";

// Developer Mode resets itself more than it should on Revenge - this re-asserts it every time the
// user's settings proto changes rather than guessing why.
const UserSettingsModule = findByProps("DeveloperMode", "DarkSidebar");

const PresenceStore = findByStoreName("PresenceStore");

// message.interaction/interactionMetadata/interaction_metadata - checked in that order to cover
// whichever field a given build populates.
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
                            // Next settings change retries it.
                        }
                    };

                    enforce();
                    this.patches.add(fluxSubscribe("USER_SETTINGS_PROTO_UPDATE", enforce));

                    // Fallback poll in case something resets it without that event firing.
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
