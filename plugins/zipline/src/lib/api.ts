import { storage } from "@vendetta/plugin";

const DEFAULT_HOST = "i.allyapp.cc";

interface ZiplineStorage {
    token?: string;
    host?: string;
    autoUpload: boolean;
    autoShorten: boolean;
}

export function zStorage(): ZiplineStorage {
    const s = storage as any;
    s.autoUpload ??= true;
    s.autoShorten ??= true;
    return s;
}

function host(): string {
    const h = zStorage().host?.trim();
    return (h || DEFAULT_HOST).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function baseUrl(): string {
    return `https://${host()}`;
}

export function isConfigured(): boolean {
    return !!zStorage().token?.trim();
}

export function isExcludedDomain(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return true;
    }

    const excluded = ["discord.com", "discordapp.com", "cdn.discordapp.com", "media.discordapp.net", "discord.gg", host()];
    return excluded.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
}

export interface UploadedFile {
    url: string;
    name: string;
}

const UPLOAD_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
        );
    });
}

export async function uploadFromUrl(sourceUrl: string, name: string, type: string): Promise<UploadedFile> {
    const token = zStorage().token?.trim();
    if (!token) throw new Error("No Zipline token configured");

    const form = new FormData();
    form.append("file", { uri: sourceUrl, name, type } as any);

    const res = await withTimeout(
        fetch(`${baseUrl()}/api/upload`, {
            method: "POST",
            headers: { authorization: token },
            body: form,
        }),
        UPLOAD_TIMEOUT_MS,
        "Upload timed out",
    );

    if (!res.ok) throw new Error(`Zipline upload failed (${res.status}): ${await res.text().catch(() => "")}`);

    const json = await res.json();
    const uploaded = json?.files?.[0];
    if (!uploaded?.url) throw new Error("Zipline upload response was missing a file URL");

    return { url: uploaded.url, name: uploaded.name };
}

export async function shortenUrl(destination: string): Promise<string> {
    const token = zStorage().token?.trim();
    if (!token) throw new Error("No Zipline token configured");

    const res = await fetch(`${baseUrl()}/api/user/urls`, {
        method: "POST",
        headers: { authorization: token, "content-type": "application/json" },
        body: JSON.stringify({ destination }),
    });

    if (!res.ok) throw new Error(`Zipline shorten failed (${res.status}): ${await res.text().catch(() => "")}`);

    const json = await res.json();
    if (!json?.url) throw new Error("Zipline shorten response was missing a URL");

    return json.url;
}
