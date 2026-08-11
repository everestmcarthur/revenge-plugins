import type { ExtractAction, FluxAction, FluxStore } from "@vencord/discord-types";
import { findByStoreName } from "@vendetta/metro";
import { lazy } from "@shared/lib/lazy";

import type { CollectiblesItemType } from "@fpte/lib/records";

// findByStoreName caches a negative result forever - a real live crash confirmed this store
// wasn't registered yet at plugin-load time, and the eager version of this permanently poisoned
// itself with undefined for the rest of the session. Every call site now has to call this as a
// function and handle it possibly still being undefined, instead of importing a plain constant.
export const getProfileEffectStore = lazy((): $ProfileEffectStore | undefined => findByStoreName("ProfileEffectStore"));

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
