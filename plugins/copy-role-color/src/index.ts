import { logger } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { clipboard } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { applyPatches } from "@shared/lib/patcher";

function patchRolePill(): () => void {
    const ThemedRolePill = findByName("ThemedRolePill", false);
    if (!ThemedRolePill) return () => {};

    return after("default", ThemedRolePill, (_args: any[], res: any) => {
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

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("CopyRoleColor", logger, { "role pill long-press": patchRolePill });
    },
    onUnload: () => unpatchAll()
};
