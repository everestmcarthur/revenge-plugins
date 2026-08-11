import { rawFindByFunctionProps, rawFindByStoreName } from "../lib/rawFind";

const TAG = "[ServerDrawer]";

// Every field here was checked field-by-field against a real, currently-live quest object (Key
// Inspector's Eval console, direct QuestStore.getQuest() call) until this matched its shape
// exactly. That mattered more than it sounds: an empty task map renders nothing (Discord silently
// treats a quest with zero tasks as invalid), and a null asset string crashes
// useQuestGameLogotypeAssetUrl with "Cannot read property 'startsWith' of null" instead of just
// showing no logo - empty string doesn't. The task's `applications` entry only feeds that same
// logotype lookup, and getQuestAsset below is guarded, so it never needs to point at a real
// Discord application - confirmed live with a fake id that the dock still renders fine, just
// without a game logo.
//
// The image-asset fields use a real, always-available Discord CDN URL rather than an empty
// string - confirmed live that an empty string still resolves "successfully" through buildUrl,
// but produces a malformed URL with nothing after the trailing slash (it concatenates onto
// Discord's own CDN base rather than being recognized as already-absolute). That never crashes
// either, but a real URL costs nothing and rules out asset loading as a factor.
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

// Replaces questDockContext.ts's Context-value force entirely - confirmed live that context's
// value shape is no longer {isRendered, isVisibleToUser, quest} at all (Discord restructured it
// into pure scroll/animation coordination: {lastScrollEventSourceId, restingQuestDockMode,
// setRestingQuestDockMode, questDockOffset}), so that predicate could never match again. The real
// gate turned out to be much simpler than the hour spent chasing Flux stores and Reanimated shared
// values suggested: QuestDockWithQuestContext and everything under it (including
// QuestDockContentExpanded, which contentPatch.tsx has been correctly waiting on this whole time)
// only mounts at all once useMobileQuestDock returns a truthy quest. With no active quest, it
// returns null/undefined and Discord's own dock renders nothing - not a bug, just nothing to show.
// Feeding it a real-shaped placeholder here is what lets contentPatch.tsx's swap ever get a chance
// to fire in the first place.
export function patchFakeQuestDock(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps<any>("useMobileQuestDock");
    if (!mod) {
        console.log(TAG, "WARN: useMobileQuestDock not found yet (will retry)");
        return false;
    }

    const origUseMobileQuestDock = mod.useMobileQuestDock;
    let cachedUserId: string | undefined;
    mod.useMobileQuestDock = function (this: unknown, ...args: any[]) {
        const real = origUseMobileQuestDock.apply(this, args);
        if (real) return real;
        if (cachedUserId === undefined) {
            cachedUserId = rawFindByStoreName<any>("UserStore")?.getCurrentUser?.()?.id;
        }
        return buildFallbackQuest(cachedUserId);
    };
    cleanups.push(() => { mod.useMobileQuestDock = origUseMobileQuestDock; });

    // Matches kmmiio99o's original plugin (questDockRender.ts/questDockBase.ts) exactly - confirmed
    // live on the account this whole investigation has been stuck on (no active quest, previously
    // seemed permanently blocked no matter what useMobileQuestDock returned) that installing the
    // original plugin's simple version of this same technique rendered the dock immediately. The
    // difference from every eval-based live test tonight that hit this same pattern and either did
    // nothing or crashed: this runs at plugin load time, before Discord's own first render of the
    // Quest Dock tree, not injected mid-session into an already-running one. Both hooks live on the
    // same module as useMobileQuestDock, so no extra lookup needed.
    if (typeof mod.useIsMobileQuestDockRendered === "function") {
        const origRendered = mod.useIsMobileQuestDockRendered;
        mod.useIsMobileQuestDockRendered = function (this: unknown, ...args: any[]) {
            origRendered.apply(this, args);
            return true;
        };
        cleanups.push(() => { mod.useIsMobileQuestDockRendered = origRendered; });
    }
    if (typeof mod.useIsMobileQuestDockRenderedBase === "function") {
        const origRenderedBase = mod.useIsMobileQuestDockRenderedBase;
        mod.useIsMobileQuestDockRenderedBase = function (this: unknown, ...args: any[]) {
            origRenderedBase.apply(this, args);
            return true;
        };
        cleanups.push(() => { mod.useIsMobileQuestDockRenderedBase = origRenderedBase; });
    }

    const assetMod = rawFindByFunctionProps<any>("getQuestAsset");
    if (assetMod) {
        const origGetQuestAsset = assetMod.getQuestAsset;
        assetMod.getQuestAsset = function (this: unknown, ...args: any[]) {
            try {
                return origGetQuestAsset.apply(this, args);
            } catch {
                return { url: null, isAnimated: false };
            }
        };
        cleanups.push(() => { assetMod.getQuestAsset = origGetQuestAsset; });
    }

    console.log(TAG, "PATCH: fake Quest Dock fallback active");
    return true;
}
