import type { ExtractAction, FluxAction, FluxStore } from "@vencord/discord-types";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { lazy } from "@shared/lib/lazy";

import type { CollectiblesItemType } from "@fpte/lib/records";

// There's no dedicated ProfileEffectStore anymore - effects are served from the same shop/
// collectibles catalog used for avatar decorations and nameplates. getProfileEffectsFromCategories
// returns ProfileEffectConfig objects directly, not the old {id, skuId, config} shape this file's
// ProfileEffect type expects, so the adapter below rebuilds that shape.
const getShopEffectsUtil = lazy(() => findByProps("getProfileEffectsFromCategories") as
    { getProfileEffectsFromCategories(categories: unknown): ProfileEffectConfig[] } | undefined);
const getCategoryStore = lazy(() => findByStoreName("CollectiblesCategoryStore") as
    { categories: unknown } | undefined);

export const getProfileEffectStore = lazy((): { profileEffects: ProfileEffect[] } | undefined => {
    const util = getShopEffectsUtil();
    const categoryStore = getCategoryStore();
    if (!util || !categoryStore) return undefined;

    const configs = util.getProfileEffectsFromCategories(categoryStore.categories) ?? [];
    return {
        profileEffects: configs.map((config): ProfileEffect => ({ id: config.skuId, skuId: config.skuId, config })),
    };
});

export type ProfileEffectStoreAction = ExtractAction<FluxAction, "LOGOUT" | "PROFILE_EFFECTS_SET_TRY_IT_OUT" | "USER_PROFILE_EFFECTS_FETCH" | "USER_PROFILE_EFFECTS_FETCH_FAILURE" | "USER_PROFILE_EFFECTS_FETCH_SUCCESS">;

declare class $ProfileEffectStore extends FluxStore<ProfileEffectStoreAction> {
    static displayName: "ProfileEffectStore";

    canFetch(): boolean;
    get fetchError(): Error | undefined;
    getProfileEffectById(effectId: string): ProfileEffect | undefined;
    hasFetched(): boolean;
    get isFetching(): boolean;
    get profileEffects(): ProfileEffect[];
    get tryItOutId(): string | null;
}

export interface ProfileEffect {
    config: ProfileEffectConfig;
    id: string;
    skuId: string;
}

export interface ProfileEffectConfig {
    accessibilityLabel: string;
    animationType: number;
    description: string;
    effects: {
        duartion: number;
        height: number;
        loop: boolean;
        loopDelay: number;
        position: {
            x: number;
            y: number;
        };
        src: string;
        start: number;
        width: number;
        zIndex: number;
    }[];
    id: string;
    reducedMotionSrc: string;
    sku_id: string;
    staticFrameSrc?: string;
    thumbnailPreviewSrc: string;
    title: string;
    type: CollectiblesItemType.PROFILE_EFFECT;
}
