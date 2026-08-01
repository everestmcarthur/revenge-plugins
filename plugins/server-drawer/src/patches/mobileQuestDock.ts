import { findByProps } from "@vendetta/metro";

export function patchMobileQuestDock(cleanups: (() => void)[]): boolean {
    const mod = findByProps("useMobileQuestDock");
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
                assets: { questBarHeroVideo: null, questBarHero: null },
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
