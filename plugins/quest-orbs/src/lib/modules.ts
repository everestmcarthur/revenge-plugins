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

/**
 * rawFindByProps only checks that named properties exist on a module, not that they're real
 * functions - live-verified against this exact codebase that a decoy module matches
 * ("getAPIBaseURL"+"get"+"post") with "get" set to null, throwing "null is not a function" the
 * moment it's actually called. Discord's real internal REST client additionally has
 * getAPIBaseURL as a real function AND a V8APIError/V6OrEarlierAPIError export the decoy lacks -
 * this combo was confirmed live with an actual GET /quests/@me call before being trusted here.
 */
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

/**
 * Only used for an optional, best-effort refresh (see questCompleter.ts) - completion itself goes
 * through direct REST calls (verified live end-to-end), not this module. Live-verified: patching
 * this module's exports to OBSERVE Discord's own internal calls does not work (same-chunk closure
 * calls bypass the exports object - see project_hook_mutation_doesnt_reach_internal_calls), but
 * that limitation is specific to patching/observing internal calls. A plugin calling a function on
 * this exports object directly, as an external caller, goes through the property lookup normally
 * and is unaffected by that limitation.
 */
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
