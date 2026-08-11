export interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    OVERLAY_CACHE: KVNamespace;
    HUB: DurableObjectNamespace;
    ADMIN_TOKEN: string;
}

// Single global room every browser tab connects to - broadcasts "something changed, refetch" to
// every open tab the moment an admin write succeeds, instead of tabs only picking it up on their
// next natural fetch. Uses the Hibernatable WebSockets API (acceptWebSocket/getWebSockets) so the
// object doesn't have to stay pinned in memory (and billed) between messages - it wakes on a new
// connection, a client event, or an incoming /broadcast call, and can go back to sleep otherwise.
export class OverlayHub {
    constructor(private state: DurableObjectState, private env: Env) {}

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/broadcast") {
            const body = await request.text();
            for (const ws of this.state.getWebSockets()) {
                try { ws.send(body); } catch { /* dead socket, ignore */ }
            }
            return new Response("ok");
        }

        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("expected websocket", { status: 426 });
        }

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.state.acceptWebSocket(server);
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage() { /* clients never need to send anything, ignore */ }

    async webSocketClose(ws: WebSocket) {
        try { ws.close(); } catch { /* already closing */ }
    }
}

async function broadcast(env: Env, message: unknown) {
    const stub = env.HUB.get(env.HUB.idFromName("global"));
    await stub.fetch("https://internal/broadcast", { method: "POST", body: JSON.stringify(message) });
}

interface Command {
    cmd: string;
    desc: string;
}

// Every field is optional - a PUT only needs to send what it wants to change, and whatever isn't
// sent falls back to the git-tracked base (for a plugin that exists in git) or a sane default (for
// a brand-new draft-only plugin, which has no base to fall back to at all).
interface OverlayEntry {
    name?: string;
    description?: string;
    category?: string;
    status?: string | null;
    accent?: string;
    tagline?: string;
    note?: string;
    howItWorks?: string;
    features?: string[];
    commands?: Command[];
    limitations?: string;
    authors?: string[];
    broken?: { reason: string; since?: string } | null;
    tags?: string[];
    draft?: boolean;
    mainJs?: string; // raw plugin source - only meaningful for a draft, ignored otherwise
}

interface Row {
    id: string;
    name: string | null;
    description: string | null;
    category: string | null;
    status: string | null;
    accent: string | null;
    tagline: string | null;
    note: string | null;
    how_it_works: string | null;
    features: string | null;
    commands: string | null;
    limitations: string | null;
    authors: string | null;
    broken_reason: string | null;
    broken_since: string | null;
    tags: string;
    is_draft: number;
    manifest: string | null;
    main_js: string | null;
}

// Short TTL, not a long-lived cache - the whole point of this overlay is that a change from a phone
// should be visible almost immediately, not after a long edge-cache window.
const CACHE_KEY = "overlay:v2";
const CACHE_TTL_SECONDS = 60; // Workers KV's enforced minimum

const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,PUT,DELETE,OPTIONS,PATCH",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
};

function withCors(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
        headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
}

function rowToOverlay(row: Row): OverlayEntry & { draft: boolean } {
    return {
        name: row.name ?? undefined,
        description: row.description ?? undefined,
        category: row.category ?? undefined,
        status: row.status ?? undefined,
        accent: row.accent ?? undefined,
        tagline: row.tagline ?? undefined,
        note: row.note ?? undefined,
        howItWorks: row.how_it_works ?? undefined,
        features: row.features ? JSON.parse(row.features) : undefined,
        commands: row.commands ? JSON.parse(row.commands) : undefined,
        limitations: row.limitations ?? undefined,
        authors: row.authors ? JSON.parse(row.authors) : undefined,
        broken: row.broken_reason ? { reason: row.broken_reason, since: row.broken_since ?? undefined } : null,
        tags: row.tags ? JSON.parse(row.tags) : [],
        draft: !!row.is_draft,
    };
}

async function readAll(db: D1Database): Promise<Record<string, OverlayEntry & { draft: boolean }>> {
    const { results } = await db.prepare("SELECT * FROM overlay").all<Row>();
    const out: Record<string, OverlayEntry & { draft: boolean }> = {};
    for (const row of results) out[row.id] = rowToOverlay(row);
    return out;
}

// Shared by every read path (GET /api/overlay, GET /plugins-data.json, and install-file serving for
// draft plugins) so a change from the admin plugin shows up everywhere on the next request, not just
// on the raw overlay endpoint.
async function getOverlay(env: Env): Promise<Record<string, OverlayEntry & { draft: boolean }>> {
    const cached = await env.OVERLAY_CACHE.get(CACHE_KEY, "json");
    if (cached) return cached as Record<string, OverlayEntry & { draft: boolean }>;

    const data = await readAll(env.DB);
    await env.OVERLAY_CACHE.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: CACHE_TTL_SECONDS });
    return data;
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const DEFAULT_MAIN_JS = `export default {\n    onLoad: () => {},\n    onUnload: () => {}\n};\n`;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            return await handle(request, env);
        } catch (e) {
            console.error(e);
            return json({ error: "internal" }, 500);
        }
    },
};

async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }

    // Live-update channel - the site connects here once on load; every successful overlay write
    // broadcasts through it so an already-open tab updates without the visitor doing anything.
    if (url.pathname === "/ws") {
        const stub = env.HUB.get(env.HUB.idFromName("global"));
        return stub.fetch(request);
    }

    // The site's actual data file - computed fresh on every request by merging the git-tracked base
    // (plugins-base.json, written by generate-site.mjs at build time) with the live overlay, so any
    // change from the admin plugin is visible immediately, with no rebuild. Draft-only plugins (no
    // git base at all) are appended as their own entries.
    if (url.pathname === "/plugins-data.json") {
        const baseRes = await env.ASSETS.fetch(new URL("/plugins-base.json", request.url));
        const base = baseRes.ok ? await baseRes.json<any[]>() : [];
        const overlay = await getOverlay(env);
        const baseIds = new Set(base.map((p) => p.id));

        const merged = base.map((p) => applyOverride(p, overlay[p.id]));
        const draftOnly = Object.entries(overlay)
            .filter(([id, o]) => o.draft && !baseIds.has(id))
            .map(([id, o]) => synthesizeDraft(id, o));

        return json([...merged, ...draftOnly]);
    }

    // Dynamic install files for draft-only plugins (created via PUT /api/overlay/:id with draft:true
    // and mainJs). Checked against D1 *first*, not by probing the static asset's response status -
    // with SPA fallback enabled (see wrangler.toml's not_found_handling), a missing asset no longer
    // 404s, it serves index.html with a 200, so that status can't be used to detect "not found" here.
    // A real git-tracked plugin has no row here, so this always falls through to ASSETS for it.
    const installMatch = url.pathname.match(/^\/([\w-]+)\/install\/(manifest\.json|index\.js)$/);
    if (installMatch) {
        const [, id, file] = installMatch;
        const row = await env.DB.prepare("SELECT manifest, main_js FROM overlay WHERE id = ?1 AND is_draft = 1")
            .bind(id).first<{ manifest: string; main_js: string }>();

        if (row) {
            if (file === "manifest.json") return json(JSON.parse(row.manifest));
            return new Response(row.main_js, { headers: { "content-type": "application/javascript", ...CORS_HEADERS } });
        }

        return withCors(await env.ASSETS.fetch(request));
    }

    if (!url.pathname.startsWith("/api/")) {
        return withCors(await env.ASSETS.fetch(request));
    }

    // GET /api/overlay - public read, used by the admin plugin/site to show current values before
    // editing.
    if (url.pathname === "/api/overlay" && request.method === "GET") {
        return json(await getOverlay(env));
    }

    const match = url.pathname.match(/^\/api\/overlay\/([\w-]+)$/);
    if (match) {
        const id = match[1];
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
            return json({ error: "unauthorized" }, 401);
        }

        if (request.method === "PUT") {
            const body = await request.json<OverlayEntry>().catch(() => null);
            if (!body) return json({ error: "invalid body" }, 400);

            const existing = await env.DB.prepare("SELECT manifest, main_js FROM overlay WHERE id = ?1").bind(id).first<{ manifest: string; main_js: string }>();

            let manifest = existing?.manifest ?? null;
            let mainJs = existing?.main_js ?? null;
            if (body.draft) {
                mainJs = body.mainJs ?? mainJs ?? DEFAULT_MAIN_JS;
                const manifestObj = {
                    name: body.name ?? id,
                    description: body.description ?? "",
                    authors: (body.authors ?? []).map((n) => ({ name: n })),
                    main: "index.js",
                    hash: await sha256Hex(mainJs),
                };
                manifest = JSON.stringify(manifestObj);
            }

            await env.DB.prepare(
                `INSERT INTO overlay (
                    id, name, description, category, status, accent, tagline, note, how_it_works,
                    features, commands, limitations, authors, broken_reason, broken_since, tags,
                    is_draft, manifest, main_js, updated_at
                 ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name, description = excluded.description, category = excluded.category,
                    status = excluded.status, accent = excluded.accent, tagline = excluded.tagline,
                    note = excluded.note, how_it_works = excluded.how_it_works, features = excluded.features,
                    commands = excluded.commands, limitations = excluded.limitations, authors = excluded.authors,
                    broken_reason = excluded.broken_reason, broken_since = excluded.broken_since, tags = excluded.tags,
                    is_draft = excluded.is_draft, manifest = excluded.manifest, main_js = excluded.main_js,
                    updated_at = excluded.updated_at`,
            ).bind(
                id,
                body.name ?? null,
                body.description ?? null,
                body.category ?? null,
                body.status ?? null,
                body.accent ?? null,
                body.tagline ?? null,
                body.note ?? null,
                body.howItWorks ?? null,
                body.features ? JSON.stringify(body.features) : null,
                body.commands ? JSON.stringify(body.commands) : null,
                body.limitations ?? null,
                body.authors ? JSON.stringify(body.authors) : null,
                body.broken?.reason ?? null,
                body.broken ? (body.broken.since ?? new Date().toISOString()) : null,
                JSON.stringify(body.tags ?? []),
                body.draft ? 1 : 0,
                manifest,
                mainJs,
                new Date().toISOString(),
            ).run();

            await env.OVERLAY_CACHE.delete(CACHE_KEY);
            await broadcast(env, { type: "overlay-updated", id });
            return json({ ok: true });
        }

        if (request.method === "DELETE") {
            await env.DB.prepare("DELETE FROM overlay WHERE id = ?1").bind(id).run();
            await env.OVERLAY_CACHE.delete(CACHE_KEY);
            await broadcast(env, { type: "overlay-updated", id });
            return json({ ok: true });
        }
    }

    return json({ error: "not found" }, 404);
}

function applyOverride(base: any, over: (OverlayEntry & { draft: boolean }) | undefined) {
    if (!over) return { ...base, broken: null, tags: [], hasOverride: false, isDraft: false };
    return {
        ...base,
        hasOverride: true,
        isDraft: false,
        name: over.name ?? base.name,
        description: over.description ?? base.description,
        category: over.category ?? base.category,
        status: over.status ?? base.status,
        accent: over.accent ?? base.accent,
        tagline: over.tagline ?? base.tagline,
        note: over.note ?? base.note,
        howItWorks: over.howItWorks ?? base.howItWorks,
        features: over.features ?? base.features,
        commands: over.commands ?? base.commands,
        limitations: over.limitations ?? base.limitations,
        authors: over.authors ?? base.authors,
        broken: over.broken ?? null,
        tags: over.tags ?? [],
    };
}

function synthesizeDraft(id: string, over: OverlayEntry & { draft: boolean }) {
    const base = "https://rp.jarviscli.dev";
    return {
        id,
        isDraft: true,
        hasOverride: true,
        name: over.name ?? id,
        description: over.description ?? "",
        authors: over.authors ?? [],
        category: over.category ?? "Other",
        status: over.status ?? "new",
        broken: over.broken ?? null,
        tags: over.tags ?? [],
        accent: over.accent ?? "#5865f2",
        tagline: over.tagline ?? over.description ?? "",
        note: over.note ?? "Draft plugin - created from the admin plugin, not tracked in git.",
        howItWorks: over.howItWorks ?? "",
        features: over.features ?? [],
        commands: over.commands ?? [],
        limitations: over.limitations ?? "",
        pageUrl: `${base}/${id}/`,
        installUrl: `${base}/${id}/install/`,
        sourceUrl: "https://github.com/everestmcarthur/revenge-plugins",
        issueUrl: `https://github.com/everestmcarthur/revenge-plugins/issues/new`,
    };
}
