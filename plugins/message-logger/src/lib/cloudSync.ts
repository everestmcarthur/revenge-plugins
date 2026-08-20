import { findByName, findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { getLog, logLimitsFromStorage, replaceLog, setOnMutate } from "./store";
import type { LoggedMessage } from "./types";

const DEFAULT_HOST = "https://message-logger-sync.allyapp.workers.dev/";
const DEFAULT_CLIENT_ID = "1538636934568607744";
const DEBOUNCE_MS = 1500;

export interface CloudSyncStorage {
    enabled: boolean;
    token?: string;
    lastSyncedAt?: number;
    customHost?: string;
    customClientId?: string;
}

export function cloudSyncStorage(): CloudSyncStorage {
    (storage as any).cloudSync ??= { enabled: false };
    return (storage as any).cloudSync;
}

function host(): string {
    const h = cloudSyncStorage().customHost?.trim();
    if (!h) return DEFAULT_HOST;
    return h.endsWith("/") ? h : `${h}/`;
}

export function clientId(): string {
    return cloudSyncStorage().customClientId?.trim() || DEFAULT_CLIENT_ID;
}

export function redirectURL(): string {
    return `${host()}api/auth/authorize`;
}

export function isConnected(): boolean {
    return !!cloudSyncStorage().token;
}

export function isEnabled(): boolean {
    return !!cloudSyncStorage().enabled;
}

export function lastSyncedAt(): number | undefined {
    return cloudSyncStorage().lastSyncedAt;
}

async function authFetch(path: string, options?: RequestInit): Promise<Response | null> {
    const token = cloudSyncStorage().token;
    if (!token) return null;

    const res = await fetch(`${host()}${path}`, {
        ...options,
        headers: { ...options?.headers, authorization: token } as any,
    });

    if (res.ok) return res;
    if (res.status === 401) {
        cloudSyncStorage().token = undefined;
        showToast("Cloud sync: disconnected (your session expired, reconnect in Message Logger settings)", undefined);
        return null;
    }

    const text = await res.text().catch(() => "");
    console.error("[MessageLogger] Cloud sync request failed", res.status, text);
    return null;
}

async function getRemoteLog(): Promise<LoggedMessage[] | null> {
    const res = await authFetch("api/data");
    if (!res) return null;
    return await res.json();
}

async function pushLog(log: LoggedMessage[]): Promise<boolean> {
    const res = await authFetch("api/data", {
        method: "PUT",
        body: JSON.stringify(log),
        headers: { "content-type": "application/json" },
    });
    return !!res;
}

export async function deleteRemoteLog(): Promise<boolean> {
    const res = await authFetch("api/data", { method: "DELETE" });
    return !!res;
}

function entryKey(e: LoggedMessage): string {
    return `${e.id}:${e.kind}:${e.loggedAt}`;
}

function mergeLogs(local: LoggedMessage[], remote: LoggedMessage[]): LoggedMessage[] {
    const byKey = new Map<string, LoggedMessage>();
    for (const e of local) byKey.set(entryKey(e), e);
    for (const e of remote) byKey.set(entryKey(e), e);
    return [...byKey.values()].sort((a, b) => a.loggedAt - b.loggedAt);
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;

function pushDebounced(): void {
    if (!isEnabled() || !isConnected()) return;

    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        const ok = await pushLog(getLog());
        if (ok) cloudSyncStorage().lastSyncedAt = Date.now();
    }, DEBOUNCE_MS);
}

export async function syncNow(): Promise<boolean> {
    if (!isConnected()) return false;

    const remote = await getRemoteLog();
    if (remote === null) return false;

    const merged = mergeLogs(getLog(), remote);
    replaceLog(merged, logLimitsFromStorage());

    const ok = await pushLog(getLog());
    if (ok) cloudSyncStorage().lastSyncedAt = Date.now();
    return ok;
}

export function disconnect(): void {
    cloudSyncStorage().token = undefined;
    cloudSyncStorage().lastSyncedAt = undefined;
}

export function openOauth2Modal(): void {
    const { pushModal, popModal } = findByProps("pushModal", "popModal") as any;
    const OAuth2AuthorizeModal = findByName("OAuth2AuthorizeModal") as any;

    if (!pushModal || !OAuth2AuthorizeModal) {
        showToast("Couldn't open the Discord authorization screen", undefined);
        return;
    }

    pushModal({
        key: "message-logger-cloud-sync-authorize",
        modal: {
            key: "message-logger-cloud-sync-authorize",
            modal: OAuth2AuthorizeModal,
            animation: "slide-up",
            shouldPersistUnderModals: false,
            props: {
                clientId: clientId(),
                redirectUri: redirectURL(),
                scopes: ["identify"],
                responseType: "code",
                permissions: 0n,
                cancelCompletesFlow: false,
                callback: async ({ location }: { location?: string }) => {
                    if (!location) return;
                    try {
                        const res = await fetch(location);
                        const token = await res.text();
                        if (!res.ok) throw new Error(token);

                        cloudSyncStorage().token = token;
                        showToast("Cloud sync connected", undefined);
                        await syncNow();
                    } catch (e: any) {
                        showToast(`Cloud sync: failed to connect (${e?.message ?? e})`, undefined);
                    }
                },
                dismissOAuthModal: () => popModal("message-logger-cloud-sync-authorize"),
            },
            closable: true,
        },
    });
}

export function initCloudSync(): () => void {
    cloudSyncStorage();
    setOnMutate(pushDebounced);

    if (isEnabled() && isConnected()) syncNow();

    return () => {
        clearTimeout(syncTimer);
        setOnMutate(undefined);
    };
}
