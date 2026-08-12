import { rawFindByStoreName } from "@shared/lib/rawFind";
import { lazy } from "@shared/lib/lazy";

declare const window: any;

export interface RestResponse<T = any> {
    ok: boolean;
    status: number;
    body: T;
    headers?: any;
    text?: string;
    retryAfter?: number;
}

export interface RestClient {
    get(opts: { url: string; query?: any }): Promise<RestResponse>;
    post(opts: { url: string; body?: any }): Promise<RestResponse>;
}

export interface QuestActions {
    fetchCurrentQuests?: (...args: any[]) => any;
}

// rawFindByProps only checks that named properties exist, not that they're real functions - a
// decoy module can match with e.g. "get" set to null. Also requiring a real getAPIBaseURL function
// plus a V8APIError/V6OrEarlierAPIError export rules those decoys out.
export const getRestClient = lazy<RestClient>(() => {
    const modules = window?.modules;
    if (!modules) return undefined;

    for (const id in modules) {
        const def = modules[id];
        if (!def?.isInitialized) continue;
        const exports = def.publicModule?.exports;
        if (!exports) continue;

        for (const candidate of [exports, exports.default]) {
            if (!candidate) continue;
            if (
                typeof candidate.get === "function" &&
                typeof candidate.post === "function" &&
                typeof candidate.getAPIBaseURL === "function" &&
                (candidate.V8APIError || candidate.V6OrEarlierAPIError)
            ) {
                return candidate as RestClient;
            }
        }
    }

    return undefined;
});

export const getQuestStore = lazy<any>(() => rawFindByStoreName("QuestStore"));

// Only used for an optional, best-effort refresh - completion itself goes through direct REST
// calls, not this module. Calling a function on this exports object directly (as an external
// caller) works fine; PATCHING it wouldn't, since same-chunk internal calls bypass the exports
// object.
export const getQuestActions = lazy<QuestActions>(() => {
    const modules = window?.modules;
    if (!modules) return undefined;

    for (const id in modules) {
        const def = modules[id];
        if (!def?.isInitialized) continue;
        const exports = def.publicModule?.exports;
        if (!exports) continue;

        for (const candidate of [exports, exports.default]) {
            if (!candidate) continue;
            if (
                typeof candidate.enrollInQuest === "function" &&
                typeof candidate.updateVideoProgress === "function" &&
                typeof candidate.claimQuestReward === "function" &&
                typeof candidate.fetchCurrentQuests === "function"
            ) {
                return candidate as QuestActions;
            }
        }
    }

    return undefined;
});
