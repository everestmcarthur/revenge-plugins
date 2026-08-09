import { logger } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { clipboard } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { applyPatches } from "@shared/lib/patcher";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";

function patchRolePill(): () => void {
    // Confirmed against decompiled current-build Discord source: the component is now just
    // "RolePill" (at app/components_native/common/RolePill.tsx) - "ThemedRolePill" doesn't exist
    // anywhere in it. Checking both names covers older builds that might still use the old one.
    const RolePillComponent = findByName("RolePill", false) ?? findByName("ThemedRolePill", false);
    if (!RolePillComponent) return () => {};

    return after("default", RolePillComponent, (_args: any[], res: any) => {
        try {
            if (!res?.props?.onPress) return;

            const verifiedIcon = findInReactTree(res, (m) => m?.props?.roleColor);
            const roleIcon = findInReactTree(
                res,
                (m) => m?.props?.style?.[0]?.borderRadius && typeof m?.props?.style?.[1]?.backgroundColor === "string" && m.props.style[1].backgroundColor.startsWith("#"),
            );
            const color = roleIcon?.props?.style?.[1]?.backgroundColor ?? verifiedIcon?.props?.roleColor;
            if (!color) return;

            res.props.onLongPress = () => {
                clipboard.setString(color);
                showToast("Copied role color to clipboard", getAssetIDByName("ic_message_copy"));
            };
        } catch {
            // Leave the role pill without a long-press handler.
        }
    });
}

// Covers the role pills in a full profile's Roles section - a different render path from
// patchRolePill above (that one's for role mentions in message text). This section renders
// UserProfileRolesCard -> RolesList -> RoleItem, none of which are top-level exports, so we need
// createElementIntercept to catch RoleItem's reference. It hands us the role object directly with
// role.colorString already a hex string, so no need to guess at it from rendered styles.
function patchProfileRoleItem(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "copy-role-color-role-item",
        (type) => typeof type === "function" && type.name === "RoleItem",
        (RoleItem: any) => {
            const PatchedRoleItem = (props: any) => {
                const ret = RoleItem(props);

                try {
                    const color = props?.role?.colorString;
                    if (color && ret && typeof ret === "object") {
                        ret.props = {
                            ...ret.props,
                            onLongPress: () => {
                                clipboard.setString(color);
                                showToast("Copied role color to clipboard", getAssetIDByName("ic_message_copy"));
                            }
                        };
                    }
                } catch {
                    // Leave the role item without a long-press handler.
                }

                return ret;
            };

            registerIntercept(RoleItem, PatchedRoleItem);
        }
    );

    return () => cleanups.forEach((fn) => fn());
}

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("CopyRoleColor", logger, {
            "role pill long-press": patchRolePill,
            "profile role item long-press": patchProfileRoleItem
        });
    },
    onUnload: () => unpatchAll()
};
