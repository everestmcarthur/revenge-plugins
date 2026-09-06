import { after } from "@vendetta/patcher";
import { findByName, findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { findInReactTree } from "@vendetta/utils";
import { showToast } from "@vendetta/ui/toasts";
import type { AntiedStorage } from "../lib/types";

const PROFILE_MENU_NAMES = ["UserProfileOverflowMenu", "BotUserProfileOverflowMenu"];
const UserStore = findByStoreName("UserStore");

function getMainItems(ret: any): any[] | null {
    let items = ret?.props?.items;
    if (Array.isArray(items) && Array.isArray(items[0])) return items[0];
    items = ret?.props?.children?.props?.items;
    if (Array.isArray(items) && Array.isArray(items[0])) return items[0];
    const node = findInReactTree(ret, (n: any) => Array.isArray(n?.props?.items) && Array.isArray(n.props.items[0]));
    return node?.props?.items?.[0] ?? null;
}

export function patchContextMenu(isEnabledRef: { current: boolean }): () => void {
    const unpatches: (() => void)[] = [];

    for (const name of PROFILE_MENU_NAMES) {
        const mod = findByName(name, false);
        if (!mod) continue;

        unpatches.push(
            after("default", mod, (args: any[], ret: any) => {
                if (!isEnabledRef.current) return;
                try {
                    const props = args[0] ?? {};
                    const userId = props.user?.id || props.userId;
                    if (!userId) return;

                    const items = getMainItems(ret);
                    if (!items) return;

                    if (items.some((item: any) => item?.label?.includes("(Antied)"))) return;

                    const cfg = storage as AntiedStorage;
                    cfg.inputs ??= {} as any;
                    cfg.inputs.ignoredUserList ??= [];

                    const isIgnored = cfg.inputs.ignoredUserList.some((u) => u.id === userId);
                    const user = UserStore?.getUser?.(userId);
                    const username = user?.username || userId;

                    items.push({
                        label: isIgnored ? "Unignore User (Antied)" : "Ignore User (Antied)",
                        isDestructive: !isIgnored,
                        action: () => {
                            if (isIgnored) {
                                cfg.inputs.ignoredUserList = cfg.inputs.ignoredUserList.filter((u) => u.id !== userId);
                                showToast(`Unignored ${username} in Antied`);
                            } else {
                                cfg.inputs.ignoredUserList.push({ id: userId, username });
                                showToast(`Ignored ${username} in Antied`);
                            }
                        },
                    });
                } catch (e) {
                    console.error("[ANTIED] Context menu error:", e);
                }
            })
        );
    }

    return () => {
        for (const fn of unpatches) fn();
    };
}
