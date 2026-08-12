import { logger } from "@vendetta";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

import { getRestClient, getQuestStore, getQuestActions } from "./modules";

const TAG = "[QuestOrbs]";

// Matches Discord's own ~7-8s video-progress heartbeat cadence - real-time paced, never sped up.
const HEARTBEAT_INTERVAL_MS = 8000;

export interface QuestRunResult {
    completed: string[];
    needsManualClaim: string[];
    failed: string[];
    skipped: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVideoQuest(quest: any): boolean {
    return !!quest?.config?.taskConfigV2?.tasks?.WATCH_VIDEO_ON_MOBILE;
}

function isAlreadyClaimed(quest: any): boolean {
    return !!quest?.userStatus?.claimedAt;
}

function questName(quest: any): string {
    return quest?.config?.messages?.questName ?? quest?.id ?? "unknown quest";
}

// Discord's wire format is snake_case, distinct from QuestStore's camelCase quest objects.
function questActionBody(quest: any, extra?: Record<string, unknown>) {
    return {
        location: 12,
        is_targeted: false,
        metadata_sealed: null,
        traffic_metadata_sealed: quest.trafficMetadataSealed ?? null,
        ...extra,
    };
}

async function enroll(rest: ReturnType<typeof getRestClient>, quest: any): Promise<void> {
    await rest!.post({
        url: `/quests/${quest.id}/enroll`,
        body: questActionBody(quest),
    });
}

// Sends real-time-paced heartbeats until completed_at flips non-null.
async function watchVideo(rest: ReturnType<typeof getRestClient>, quest: any): Promise<boolean> {
    const target: number = quest.config.taskConfigV2.tasks.WATCH_VIDEO_ON_MOBILE.target;
    let elapsed = 0;

    while (elapsed < target) {
        await sleep(HEARTBEAT_INTERVAL_MS);
        elapsed = Math.min(elapsed + HEARTBEAT_INTERVAL_MS / 1000, target);

        const res = await rest!.post({
            url: `/quests/${quest.id}/video-progress`,
            body: { timestamp: elapsed },
        });

        if (res?.body?.completed_at) return true;
    }

    return false;
}

type ClaimOutcome = "claimed" | "captcha" | "error";

// Detects a captcha_key response and stops - never attempts to solve or bypass it. Checks both a
// thrown error and a resolved-but-not-ok response, since which path the REST client takes on a
// non-2xx isn't pinned down.
async function claim(rest: ReturnType<typeof getRestClient>, quest: any): Promise<ClaimOutcome> {
    try {
        const res = await rest!.post({
            url: `/quests/${quest.id}/claim-reward`,
            body: questActionBody(quest, { platform: 0 }),
        });

        if (res?.ok) return "claimed";
        if (res?.body?.captcha_key) return "captcha";
        return "error";
    } catch (e: any) {
        if (e?.body?.captcha_key || e?.captcha_key) return "captcha";
        logger.error(`${TAG} claim-reward request failed for "${questName(quest)}": ${e}`);
        return "error";
    }
}

// Best-effort refresh so Discord's UI doesn't show stale data after completing quests via direct
// REST calls instead of Discord's own action creators. Purely cosmetic.
function refreshQuestStore(): void {
    try {
        getQuestActions()?.fetchCurrentQuests?.();
    } catch (e) {
        logger.error(`${TAG} best-effort QuestStore refresh failed (non-fatal): ${e}`);
    }
}

export async function completeAllVideoQuests(): Promise<QuestRunResult> {
    const result: QuestRunResult = { completed: [], needsManualClaim: [], failed: [], skipped: 0 };

    const rest = getRestClient();
    const questStore = getQuestStore();
    if (!rest || !questStore?.quests) {
        logger.error(`${TAG} REST client or QuestStore not available yet - Discord hasn't loaded the Quests feature in this session`);
        return result;
    }

    const quests: any[] = Array.from(questStore.quests.values()).filter(isVideoQuest);

    for (const quest of quests) {
        try {
            if (isAlreadyClaimed(quest)) {
                result.skipped++;
                continue;
            }

            if (!quest.userStatus?.enrolledAt) {
                await enroll(rest, quest);
            }

            if (!quest.userStatus?.completedAt) {
                const done = await watchVideo(rest, quest);
                if (!done) {
                    result.failed.push(questName(quest));
                    continue;
                }
            }

            const outcome = await claim(rest, quest);
            if (outcome === "claimed") {
                result.completed.push(questName(quest));
            } else if (outcome === "captcha") {
                result.needsManualClaim.push(questName(quest));
                showToast(`"${questName(quest)}" needs manual claim (captcha) - open it in Discord`, getAssetIDByName("ic_warning_24px"));
            } else {
                result.failed.push(questName(quest));
            }
        } catch (e) {
            logger.error(`${TAG} Failed on quest "${questName(quest)}": ${e}`);
            result.failed.push(questName(quest));
        }
    }

    if (result.completed.length > 0) refreshQuestStore();

    return result;
}
