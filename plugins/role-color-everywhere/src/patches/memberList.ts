import { findByStoreName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { storage } from "@vendetta/plugin";

const { View } = ReactNative;
const GuildStore = findByStoreName("GuildStore");

// Colors the role section headers in the member list. Patches the generic View render, since these headers
// aren't exposed as a named component - `roleId` on the found node is what narrows it down to the right one.
export default function patchMemberList(): () => void {
    if (!View) return () => {};

    return after("render", View, (_: any, res: any) => {
        try {
            if (storage.noRole) return;

            const roleHeader = findInReactTree(res, (r) => r?.props?.roleId !== undefined);
            if (!roleHeader) return;
            if (Number.isNaN(Number(roleHeader.props.roleId))) return;
            if (roleHeader.props.excludedApplications) return;
            if ("displayRoleIcon" in roleHeader.props) return;
            if ("searchable" in roleHeader.props) return;

            const outer = { type: { ...roleHeader.type } };
            after("type", outer.type, (_: any, inner: any) => {
                const labelWrapper = inner?.props?.children?.[1];
                if (!labelWrapper?.type) return;

                const label = { type: { ...labelWrapper.type } };
                after("render", label.type, (_: any, labelRes: any) => {
                    const role = GuildStore?.getGuild(roleHeader.props.guildId)?.roles?.[roleHeader.props.roleId];
                    if (!role?.colorString || !labelRes?.props?.style?.push) return;
                    labelRes.props.style.push({ color: role.colorString });
                });

                labelWrapper.type = label.type;
            });

            roleHeader.type = outer.type;
        } catch {
            // Skip this render pass - a header staying uncolored beats a crashed member list.
        }
    });
}
