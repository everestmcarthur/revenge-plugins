const BASE_URL = "https://revenge-plugins-backend.allyapp.workers.dev";

export interface PluginStatus {
    blocked: boolean;
    latestHash: string | null;
}

export async function checkPluginStatus(userId: string | undefined, manifestUrl?: string): Promise<PluginStatus> {
    if (!userId) return { blocked: true, latestHash: null };

    try {
        const params = new URLSearchParams({ userId });
        if (manifestUrl) params.set("manifestUrl", manifestUrl);

        const res = await fetch(`${BASE_URL}/status?${params}`);
        if (!res.ok) return { blocked: true, latestHash: null };

        const data = await res.json();
        return { blocked: data?.blocked !== false, latestHash: data?.latestHash ?? null };
    } catch {
        return { blocked: true, latestHash: null };
    }
}

export async function syncPull(pluginId: string, authToken: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/sync/${pluginId}`, {
        headers: { Authorization: authToken }
    });
    if (!res.ok) throw new Error(`Sync pull failed: ${res.status}`);
    return res.json();
}

export async function syncPush(pluginId: string, authToken: string, data: unknown): Promise<void> {
    const res = await fetch(`${BASE_URL}/sync/${pluginId}`, {
        method: "PUT",
        headers: { Authorization: authToken, "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Sync push failed: ${res.status}`);
}

export async function syncDelete(pluginId: string, authToken: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/sync/${pluginId}`, {
        method: "DELETE",
        headers: { Authorization: authToken }
    });
    if (!res.ok) throw new Error(`Sync delete failed: ${res.status}`);
}
