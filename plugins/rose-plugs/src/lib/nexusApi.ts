export interface NexusPlugin {
    id: string;
    name: string;
    description: string;
    authors: string[];
    category: string;
    status: string;
    accent: string;
    tagline: string;
    note: string;
    howItWorks: string;
    features: string[];
    commands: string[];
    limitations: string;
    pageUrl: string;
    installUrl: string;
    sourceUrl: string;
    issueUrl: string;
}

const NEXUS_URL = "https://rp.jarviscli.dev/plugins-data.json";

let cache: NexusPlugin[] | null = null;
let inflight: Promise<NexusPlugin[]> | null = null;

export async function fetchNexusPlugins(force = false): Promise<NexusPlugin[]> {
    if (!force && cache) return cache;
    if (!force && inflight) return inflight;

    inflight = fetch(NEXUS_URL)
        .then((res) => {
            if (!res.ok) throw new Error(`Nexus fetch failed: ${res.status}`);
            return res.json();
        })
        .then((data: NexusPlugin[]) => {
            cache = data;
            inflight = null;
            return data;
        })
        .catch((e) => {
            inflight = null;
            throw e;
        });

    return inflight;
}

export function clearNexusCache(): void {
    cache = null;
}
