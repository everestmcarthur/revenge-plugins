import { instead } from "@vendetta/patcher";

import { CollectiblesPurchaseStore } from "@fpte/lib/stores";
import { previewUserId } from "@fpte/patches/patchUseProfileTheme";

export const patchGetPurchase = () => instead(
    "getPurchase",
    CollectiblesPurchaseStore,
    (args: unknown[], origFunc: (...args: any[]) => unknown) => previewUserId
        ? { purchasedAt: new Date() }
        : origFunc(args)
);
