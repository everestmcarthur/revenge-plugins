import { logger, plugin } from "@vendetta";
import { findByStoreName, findByProps } from "@vendetta/metro";
import { removePlugin } from "@vendetta/plugins";
import { safeFetch } from "@vendetta/utils";
import { showToast } from "@vendetta/ui/toasts";

const UserStore = findByStoreName("UserStore");
const AuthStore = findByStoreName("AuthenticationStore") || findByProps("getToken");

export const DEFAULT_BLACKLIST_URL = "https://raw.githubusercontent.com/everestmcarthur/revenge-plugins/main/blacklist.json";

/**
 * Local fallback blacklist: Any Discord User IDs hardcoded here.
 */
export const LOCAL_BLACKLIST: string[] = [];

function getCurrentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id || AuthStore?.getId?.() || AuthStore?.getCurrentUser?.()?.id;
}

/** Grab list from remote url, cache it, and remove self if the user is blacklisted */
export async function fetchBlacklist(url: string = DEFAULT_BLACKLIST_URL): Promise<{ list: (string | number)[] }> {
    try {
        const bustUrl = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
        const res = await safeFetch(bustUrl, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            return { list: Array.isArray(data?.list) ? data.list : [] };
        }
    } catch (e: any) {
        logger.info("[Blacklist] Unable to fetch remote blacklist data:", e?.message ?? e);
    }
    return { list: [] };
}

/** Check if user is in local or remote blacklist and trigger self-deletion if matched */
export function checkAndEnforceBlacklist(
    blocklist?: { list?: (string | number)[] },
    pluginId: string = plugin?.id,
    delaySeconds = 15
): boolean {
    const myId = getCurrentUserId();
    if (!myId) return false;

    // Combine local static blacklist with remote blacklist
    const combined = new Set<string>([
        ...LOCAL_BLACKLIST.map(String),
        ...(blocklist?.list?.map(String) || []),
    ]);

    if (!combined.size) return false;

    const isBlacklisted = combined.has(String(myId));
    if (isBlacklisted && pluginId) {
        logger.warn(`Yippe! You found a secret!`);
        try {
        } catch (_) {}

        setTimeout(() => {
            logger.info("Yippe!!!:", pluginId);
            try {
                removePlugin(pluginId);
            } catch (e: any) {
                logger.error("Oh no!:", e?.message ?? e);
            }
        }, delaySeconds * 1000);
        return true;
    }
    return false;
}

/**
 * Standard 1-line enforcement for any plugin's onLoad lifecycle.
 * Checks local blacklist immediately, then fetches remote in background.
 */
export function enforceBlacklistOnLoad(pluginId: string = plugin?.id, delaySeconds = 15): boolean {
    if (checkAndEnforceBlacklist(undefined, pluginId, delaySeconds)) {
        return true;
    }

    fetchBlacklist(DEFAULT_BLACKLIST_URL)
        .then((blocklist) => {
            checkAndEnforceBlacklist(blocklist, pluginId, delaySeconds);
        })
        .catch((e) => {
            logger.info("[Blacklist] Remote check failed:", e?.message ?? e);
        });

    return false;
}
