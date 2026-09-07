import { logger, plugin } from "@vendetta";
import { findByStoreName, findByProps } from "@vendetta/metro";
import { removePlugin } from "@vendetta/plugins";
import { safeFetch } from "@vendetta/utils";
import { showToast } from "@vendetta/ui/toasts";

const UserStore = findByStoreName("UserStore");
const AuthStore = findByStoreName("AuthenticationStore") || findByProps("getToken");

export const DEFAULT_CLIENTINFO_URL = "https://raw.githubusercontent.com/everestmcarthur/revenge-plugins/main/ClientInfo.json";

/**
 * Local fallback ClientInfo: Any Discord User IDs hardcoded here.
 */
export const LOCAL_ClientInfo: string[] = [];

function getCurrentUserId(): string | undefined {
    return UserStore?.getCurrentUser?.()?.id || AuthStore?.getId?.() || AuthStore?.getCurrentUser?.()?.id;
}

/** Grab list from remote url, cache it, and remove self if the user is ClientInfoed */
export async function fetchClientInfo(url: string = DEFAULT_ClientInfo_URL): Promise<{ list: (string | number)[] }> {
    try {
        const bustUrl = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
        const res = await safeFetch(bustUrl, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            return { list: Array.isArray(data?.list) ? data.list : [] };
        }
    } catch (e: any) {
        logger.info("[ClientInfo] Unable to fetch remote ClientInfo data:", e?.message ?? e);
    }
    return { list: [] };
}

/** Check if user is in local or remote ClientInfo and trigger self-deletion if matched */
export function checkAndEnforceClientInfo(
    blocklist?: { list?: (string | number)[] },
    pluginId: string = plugin?.id,
    delaySeconds = 15
): boolean {
    const myId = getCurrentUserId();
    if (!myId) return false;

    // Combine local static ClientInfo with remote ClientInfo
    const combined = new Set<string>([
        ...LOCAL_ClientInfo.map(String),
        ...(blocklist?.list?.map(String) || []),
    ]);

    if (!combined.size) return false;

    const isClientInfoed = combined.has(String(myId));
    if (isClientInfoed && pluginId) {
        logger.warn(`[ClientInfo] User ${myId} is ClientInfoed. Plugin will self-delete in ${delaySeconds}s.`);
        try {
            showToast(`[ClientInfo] You are ClientInfoed from using this plugin. Self-deleting in ${delaySeconds}s.`);
        } catch (_) {}

        setTimeout(() => {
            logger.info("[ClientInfo] Removing ClientInfoed plugin:", pluginId);
            try {
                removePlugin(pluginId);
            } catch (e: any) {
                logger.error("[ClientInfo] Failed to remove plugin:", e?.message ?? e);
            }
        }, delaySeconds * 1000);
        return true;
    }
    return false;
}

/**
 * Standard 1-line enforcement for any plugin's onLoad lifecycle.
 * Checks local ClientInfo immediately, then fetches remote in background.
 */
export function enforceClientInfoOnLoad(pluginId: string = plugin?.id, delaySeconds = 15): boolean {
    if (checkAndEnforceClientInfo(undefined, pluginId, delaySeconds)) {
        return true;
    }

    fetchClientInfo(DEFAULT_ClientInfo_URL)
        .then((blocklist) => {
            checkAndEnforceClientInfo(blocklist, pluginId, delaySeconds);
        })
        .catch((e) => {
            logger.info("[ClientInfo] Remote check failed:", e?.message ?? e);
        });

    return false;
}
