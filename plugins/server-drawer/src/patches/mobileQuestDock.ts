import { rawFindByFunctionProps } from "../lib/rawFind";

// rawFindByFunctionProps, not findByProps or rawFindByProps - see questDockRender.ts for why
// (retried lookup that a caching findByProps would defeat, plus a confirmed-live decoy module
// with the same property names but non-function values that a plain rawFindByProps was matching).
export function patchMobileQuestDock(cleanups: (() => void)[]): boolean {
    const mod = rawFindByFunctionProps("useMobileQuestDock");
    // The upstream version of this check was `!mod.useMobileQuestDock` (no `?.`) - if the lookup
    // came back empty, that threw immediately and, since nothing here was wrapped in try/catch,
    // took every patch after this one in the onLoad sequence down with it.
    if (!mod?.useMobileQuestDock) return false;

    const orig = mod.useMobileQuestDock;
    mod.useMobileQuestDock = function (...args: any[]) {
        const real = orig.apply(this, args);
        if (real) return real;
        return {
            id: "server-drawer",
            config: {
                quest_content_type: 0,
                // Empty strings, not null: confirmed live (crash stack trace) that Discord's real
                // getQuestAsset -> resolveAsset -> buildUrl calls .startsWith() on whichever asset
                // field it reads, uncaught by this repo's own getQuestAsset try/catch patch (meaning
                // useQuestDockHeroAsset calls a reference that patch never actually reaches - likely
                // an internal same-module call that bypasses the exports-object property it mutates).
                // An empty string is falsy (same as null for any truthiness check upstream) but is a
                // valid string .startsWith() can safely be called on, so it can't crash regardless of
                // which exact code path reads it.
                assets: { questBarHeroVideo: "", questBarHero: "" },
                features: [],
            },
            userStatus: { enrolledAt: "2099-01-01", claimedAt: null },
            benefits: { rewards: [] },
            guildId: "0",
            tasks: [],
        };
    };
    cleanups.push(() => { mod.useMobileQuestDock = orig; });
    return true;
}
