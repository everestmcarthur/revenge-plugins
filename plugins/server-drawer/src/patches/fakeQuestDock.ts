import { rawFindByFunctionProps, rawFindByStoreName } from "../lib/rawFind";

const TAG = "[ServerDrawer]";

// A real, always-available Discord CDN URL - confirmed live that an empty string still resolves
// "successfully" through Discord's buildUrl (concatenates onto the CDN base rather than being
// recognized as absolute) but produces a malformed URL, and a full external https:// URL gets
// double-prefixed the same way ("https://cdn.discordapp.com/https://..."). Neither crashes -
// getQuestAsset below is guarded regardless - so this is cosmetic, not load-bearing.
const FALLBACK_ASSET_URL = "https://cdn.discordapp.com/embed/avatars/0.png";

function buildFallbackQuest(userId: string | undefined) {
    const now = new Date();
    const nowIso = now.toISOString();
    const farFuture = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 5).toISOString();

    return {
        id: "server-drawer",
        preview: false,
        config: {
            id: "server-drawer",
            configVersion: 2,
            startsAt: nowIso,
            expiresAt: farFuture,
            features: [],
            assets: {
                hero: FALLBACK_ASSET_URL, heroVideo: "", questBarHero: FALLBACK_ASSET_URL, questBarHeroBlurhash: "",
                questBarHeroVideo: "", gameTile: FALLBACK_ASSET_URL, logotype: FALLBACK_ASSET_URL,
                gameTileLight: FALLBACK_ASSET_URL, gameTileDark: FALLBACK_ASSET_URL,
                logotypeLight: FALLBACK_ASSET_URL, logotypeDark: FALLBACK_ASSET_URL,
            },
            colors: { primary: "#5865F2", secondary: "#000000" },
            messages: {
                questName: "Server Drawer",
                gameTitle: "All quests complete!",
                gamePublisher: "ServerDrawer plugin",
            },
            taskConfigV2: {
                tasks: {
                    ACHIEVEMENT_IN_ACTIVITY: {
                        type: "ACHIEVEMENT_IN_ACTIVITY",
                        target: 1,
                        eventName: "progress",
                        messages: {
                            taskTitle: "Server Drawer is active",
                            taskDescription: "You've got no active Discord quests right now - enjoy the drawer!",
                        },
                        applications: [{ id: "0" }],
                    },
                },
                joinOperator: "or",
            },
            rewardsConfig: {
                assignmentMethod: 1,
                rewards: [{
                    type: 4,
                    skuId: "0",
                    messages: {
                        redemptionInstructionsByPlatform: {},
                        name: "Nothing - just vibes",
                        nameWithArticle: "Nothing - just vibes",
                    },
                    orbQuantity: 0,
                    premiumOrbQuantity: 0,
                }],
                rewardsExpireAt: farFuture,
                platforms: [0],
            },
            cosponsorMetadata: undefined,
            sharePolicy: "shareable_everywhere",
            ctaConfig: { android: undefined, ios: undefined, link: "", buttonLabel: "", subtitle: "" },
        },
        userStatus: {
            userId: userId ?? null,
            questId: "server-drawer",
            enrolledAt: nowIso,
            completedAt: null,
            claimedAt: null,
            claimedTier: null,
            orbQuantityClaimed: 0,
            lastStreamHeartbeatAt: null,
            streamProgressSeconds: 0,
            dismissedQuestContent: 0,
            progress: {},
        },
        targetedContent: [],
        trafficMetadataSealed: "",
    };
}

// Each of these four does its own completely independent rawFind lookup rather than sharing one
// resolved module reference across all of them - confirmed live (GuildsBar's own patch writeup)
// that a metro search can land on a different module copy than another search for a related
// property, even when both "succeed", so patching useMobileQuestDock and
// useIsMobileQuestDockRendered off the same found object was never guaranteed to be the same
// reference the real render path actually reads from. Matches the original plugin's four separate
// files (questDockRender.ts, questDockBase.ts, mobileQuestDock.ts, getQuestAsset.ts) in spirit,
// just retry-safe.
export function patchMobileQuestDock(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps<any>("useMobileQuestDock");
    if (!mod?.useMobileQuestDock) {
        console.log(TAG, "WARN: useMobileQuestDock not found yet (will retry)");
        return false;
    }
    const orig = mod.useMobileQuestDock;
    let cachedUserId: string | undefined;
    mod.useMobileQuestDock = function (this: unknown, ...args: any[]) {
        const real = orig.apply(this, args);
        if (real) return real;
        if (cachedUserId === undefined) {
            cachedUserId = rawFindByStoreName<any>("UserStore")?.getCurrentUser?.()?.id;
        }
        return buildFallbackQuest(cachedUserId);
    };
    cleanups.push(() => { mod.useMobileQuestDock = orig; });
    return true;
}

export function patchQuestDockRender(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps<any>("useIsMobileQuestDockRendered");
    if (!mod?.useIsMobileQuestDockRendered) {
        console.log(TAG, "WARN: useIsMobileQuestDockRendered not found yet (will retry)");
        return false;
    }
    const orig = mod.useIsMobileQuestDockRendered;
    mod.useIsMobileQuestDockRendered = function (this: unknown, ...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRendered = orig; });
    return true;
}

export function patchQuestDockBase(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps<any>("useIsMobileQuestDockRenderedBase");
    if (!mod?.useIsMobileQuestDockRenderedBase) {
        console.log(TAG, "WARN: useIsMobileQuestDockRenderedBase not found yet (will retry)");
        return false;
    }
    const orig = mod.useIsMobileQuestDockRenderedBase;
    mod.useIsMobileQuestDockRenderedBase = function (this: unknown, ...args: any[]) {
        orig.apply(this, args);
        return true;
    };
    cleanups.push(() => { mod.useIsMobileQuestDockRenderedBase = orig; });
    return true;
}

export function patchGetQuestAsset(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps<any>("getQuestAsset");
    if (!mod?.getQuestAsset) {
        console.log(TAG, "WARN: getQuestAsset not found yet (will retry)");
        return false;
    }
    const orig = mod.getQuestAsset;
    mod.getQuestAsset = function (this: unknown, ...args: any[]) {
        try {
            return orig.apply(this, args);
        } catch {
            return { url: null, isAnimated: false };
        }
    };
    cleanups.push(() => { mod.getQuestAsset = orig; });
    return true;
}
