import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { showToast } from "@vendetta/ui/toasts";
import { clipboard } from "@vendetta/metro/common";
import { getSettings, TokenManager, UserStore } from "../lib/accounts";
import { addLog } from "../lib/logger";

const OPTION_LABEL = "Copy Token";

export default function patchContextMenu(): () => void {
    return before("render", findByProps("ScrollView").View, (args: any[]) => {
        try {
            if (!getSettings().enableUnsafeFeatures) return;

            const sheet = findInReactTree(args, (r: any) => r.key === ".$UserProfileOverflow");
            if (!sheet?.props || sheet.props.sheetKey !== "UserProfileOverflow") return;

            const props = sheet.props.content.props;
            if (props.options.some((option: any) => option?.label === OPTION_LABEL)) return;

            const currentUserId = UserStore.getCurrentUser()?.id;
            const focusedUserId = Object.keys(sheet._owner.stateNode._keyChildMapping)
                .find((str: string) => sheet._owner.stateNode._keyChildMapping[str] && str.match(/(?<=\$UserProfile)\d+/))
                ?.slice(".$UserProfile".length) ?? currentUserId;
            const token = TokenManager.getToken();

            props.options.unshift({
                isDestructive: true,
                label: OPTION_LABEL,
                onPress: () => {
                    try {
                        clipboard.setString(focusedUserId === currentUserId ? token : "");
                        showToast(focusedUserId === currentUserId ? "Copied your token" : "Can only copy the current account's token", undefined);
                        props.hideActionSheet();
                    } catch (e: any) {
                        addLog("error", "Failed to copy token from context menu", { error: e?.message });
                        showToast("Failed to copy token", undefined);
                    }
                }
            });
        } catch (e: any) {
            addLog("error", "Context menu patch error", { error: e?.message });
        }
    });
}
