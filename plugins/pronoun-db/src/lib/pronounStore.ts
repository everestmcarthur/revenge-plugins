import { safeFetch } from "@vendetta/utils";

// PronounDB's v1 API (used by the original version of this plugin) has since been shut down (HTTP 410) -
// this uses their current v2 API instead.
const PRONOUN_LABELS: Record<string, string> = {
    he: "he/him",
    she: "she/her",
    they: "they/them",
    it: "it/its",
    any: "any",
    other: "other",
    ask: "ask",
    avoid: "avoid, use name"
};

function formatCodes(codes: string[] | undefined): string | undefined {
    if (!codes?.length) return undefined;
    return codes.map(c => PRONOUN_LABELS[c] ?? c).join(" / ");
}

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<(value: string | undefined) => void>>();
let queue = new Set<string>();
let flushTimer: any;

function notify(id: string, value: string | undefined) {
    listeners.get(id)?.forEach(cb => cb(value));
    listeners.delete(id);
}

async function flush() {
    const ids = [...queue];
    queue = new Set();
    if (!ids.length) return;

    try {
        const res = await safeFetch(`https://pronoundb.org/api/v2/lookup?platform=discord&ids=${ids.join(",")}`, {
            headers: { Accept: "application/json" }
        });
        const data = await res.json();

        for (const id of ids) {
            const display = formatCodes(data?.[id]?.sets?.en);
            cache.set(id, display ?? null);
            notify(id, display);
        }
    } catch {
        for (const id of ids) {
            cache.set(id, null);
            notify(id, undefined);
        }
    }
}

export function getCachedPronouns(userId: string): string | undefined {
    return cache.get(userId) ?? undefined;
}

/** Subscribes to a user's pronouns, batching lookups across everything rendering at once. Returns an unsubscribe fn. */
export function fetchPronouns(userId: string, onResult: (value: string | undefined) => void): () => void {
    if (cache.has(userId)) {
        onResult(cache.get(userId) ?? undefined);
        return () => {};
    }

    if (!listeners.has(userId)) listeners.set(userId, new Set());
    listeners.get(userId)!.add(onResult);

    queue.add(userId);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 150);

    return () => listeners.get(userId)?.delete(onResult);
}
