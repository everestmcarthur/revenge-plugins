import { React, ReactNative } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { registerPropsTransform, patchCreateElement } from "@shared/lib/createElementIntercept";

const { Text } = ReactNative;
const SelectedGuildStore = findByStoreName("SelectedGuildStore");
const GuildRoleStore = findByStoreName("GuildRoleStore");

// Colors the role section headers in the member list ("MODERATORS", "ADMINS", etc). Only a
// pre-formatted title string like "🚨 Moderator — 1" is available on UserSectionInner, so the role
// name is parsed back out of it and matched against the guild's roles by name.
export default function patchMemberList(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerPropsTransform(
        (props: any, type: any) => {
            if (storage.noRole) return false;
            if (typeof props?.title !== "string") return false;
            const isSectionHeader = typeof type === "function" ? type.name === "UserSectionInner" : type?.type?.name === "UserSectionInner";
            return isSectionHeader;
        },
        (props: any) => {
            try {
                const stripped = props.title.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s*—\s*\d+$/, "").trim();
                if (!stripped) return props;

                const guildId = SelectedGuildStore?.getGuildId?.();
                const roles = guildId ? GuildRoleStore?.getSortedRoles?.(guildId) : null;
                const role = roles?.find((r: any) => r.name === stripped);
                if (!role?.colorString) return props;

                return { ...props, title: React.createElement(Text, { style: { color: role.colorString } }, props.title) };
            } catch {
                return props;
            }
        }
    );

    return () => cleanups.forEach((fn) => fn());
}
