import { findByStoreName } from "@vendetta/metro";
import { patchRows } from "@shared/lib/patchRows";

import { Module, ModuleCategory } from "../../lib/Module";
import dark from "./dark.png";
import light from "./light.png";

// It's just like Among Us
const GuildMemberStore = findByStoreName("GuildMemberStore");

export default new Module({
    id: "minimod",
    label: "Minimod",
    meta: {
        sublabel: "Lets you see some moderator-only things, like whether a member is currently timed out",
        category: ModuleCategory.Fun,
    },
    settings: {
        showTimeouts: {
            label: "Show timeouts",
            subLabel: "Show member timeout icons in chat",
            type: "toggle",
            default: true,
        },
    },
    handlers: {
        onStart() {
            // getCommunicationDisabledUserMap doesn't exist anymore (confirmed against decompiled
            // current-build Discord source) - GuildMemberStore only exposes per-member lookups now,
            // via getMember(guildId, userId).communicationDisabledUntil.
            if (!this.storage.options.showTimeouts || !GuildMemberStore?.getMember) return;

            this.patches.add(
                patchRows((rows) => {
                    if (!rows.some((row) => "message" in row)) return;

                    const now = Date.now();

                    for (const row of rows) {
                        if (row.type !== 1) continue;

                        const until = GuildMemberStore.getMember(row.message.guildId, row.message.authorId)?.communicationDisabledUntil;
                        if (until && new Date(until).getTime() > now) {
                            row.message.communicationDisabled = true;
                        }
                    }
                }),
            );
        },
        onStop() {},
    },
});
