import { registerPropsTransform } from "../lib/createElementIntercept";

const TAG = "[ServerDrawer]";

/**
 * Replaces every hook-mutation patch that used to live in questDockRender.ts, questDockBase.ts,
 * questDockVisible.ts, mobileQuestDock.ts, and getQuestAsset.ts. All five mutated a hook or utility
 * function's exported property (`someModule.useSomeHook = wrapper`) - confirmed live (Key
 * Inspector fiber capture) that this never reached the real call site at all: Discord's Quest Dock
 * hooks call each other via an internal, same-chunk closure reference, not through the exports
 * object property these patches mutated. The proof: with every one of those patches active, the
 * live Context value at QuestDockExternalCoordinationContextProviderInner still carried a real
 * Discord quest snowflake ID, never this plugin's fake "server-drawer" quest.
 *
 * QuestDockExternalCoordinationContextProviderInner assembles exactly the state we need
 * (isRendered, isVisibleToUser, quest) from those hooks and hands it down through a Context
 * Provider - and a Provider element is always created through the one shared createElement/jsx
 * runtime, the same interception point GuildsBar's patch already relies on successfully. So instead
 * of trying to fake the hooks' return values, this rewrites the Provider's `value` prop directly,
 * which reaches every consumer exactly as if the hooks themselves had returned it.
 */
export function patchQuestDockContext(cleanups: (() => void)[]): boolean {
    registerPropsTransform(
        (props) => {
            const v = props?.value;
            return !!(v && typeof v === "object" &&
                "isRendered" in v && "isVisibleToUser" in v && "quest" in v);
        },
        (props) => {
            const v = props.value;
            const quest = v.quest ?? fallbackQuest();
            return {
                ...props,
                value: {
                    ...v,
                    isRendered: true,
                    isVisibleToUser: true,
                    quest: sanitizeQuestAssets(quest),
                },
            };
        }
    );
    cleanups.push(() => {
        // No per-call unregister needed - createElementIntercept clears all transforms/intercepts
        // together when its own patch unwinds, part of this plugin's normal unload/restart cleanup.
    });
    console.log(TAG, "PATCH: watching for the Quest Dock coordination context");
    return true;
}

function fallbackQuest(): any {
    return {
        id: "server-drawer",
        config: {
            quest_content_type: 0,
            assets: { questBarHeroVideo: "", questBarHero: "" },
            features: [],
        },
        userStatus: { enrolledAt: "2099-01-01", claimedAt: null },
        benefits: { rewards: [] },
        guildId: "0",
        tasks: [],
    };
}

// Same fix as the old mobileQuestDock.ts fallback, but now also applied to REAL quest data - a
// real, currently-active quest that has no hero media at all sets these fields to null too
// (confirmed: the crash reproduced with this plugin's own hook patches active, at a point where
// this quest's real ID was flowing through unmodified - meaning the null came from Discord's own
// quest, not this plugin's fallback). Empty string is falsy for any truthiness check upstream, same
// as null, but is a valid string .startsWith() can't throw on.
function sanitizeQuestAssets(quest: any): any {
    const assets = quest?.config?.assets;
    if (!assets) return quest;
    const hero = assets.questBarHero;
    const heroVideo = assets.questBarHeroVideo;
    if (hero != null && heroVideo != null) return quest;
    return {
        ...quest,
        config: {
            ...quest.config,
            assets: {
                ...assets,
                questBarHero: hero ?? "",
                questBarHeroVideo: heroVideo ?? "",
            },
        },
    };
}
