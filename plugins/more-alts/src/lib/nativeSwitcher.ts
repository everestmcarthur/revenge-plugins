import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { getSettings } from "./accounts";

const AccountDispatcher = findByProps("getCanUseMultiAccountMobile");
const MultiAccountStore = findByStoreName("MultiAccountStore");

export default function patchNativeSwitcher(): () => void {
    if (!getSettings().enableNativeSwitcher || !AccountDispatcher || !MultiAccountStore) {
        return () => {};
    }

    const unpatch = after("getCanUseMultiAccountMobile", AccountDispatcher, () => true);

    Object.defineProperty(MultiAccountStore, "canUseMultiAccountNotifications", {
        get: () => true,
        configurable: true
    });

    return () => {
        unpatch();
        delete (MultiAccountStore as any).canUseMultiAccountNotifications;
    };
}
