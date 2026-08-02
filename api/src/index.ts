export interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    OVERLAY_CACHE: KVNamespace;
    ADMIN_TOKEN: string;
}

interface OverlayEntry {
    status?: string | null;
    broken?: { reason: string; since?: string } | null;
    tags?: string[];
}

// Short TTL, not a long-lived cache - the whole point of this overlay is that a status/broken/tag
// flip from a phone should be visible almost immediately, not after a long edge-cache window.
const CACHE_KEY = "overlay:v1";
const CACHE_TTL_SECONDS = 60; // Workers KV's enforced minimum

const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
}

async function readAll(db: D1Database): Promise<Record<string, OverlayEntry>> {
    const { results } = await db.prepare("SELECT * FROM overlay").all<Record<string, unknown>>();
    const out: Record<string, OverlayEntry> = {};
    for (const row of results) {
        const id = row.id as string;
        out[id] = {
            status: (row.status as string) ?? undefined,
            broken: row.broken_reason
                ? { reason: row.broken_reason as string, since: row.broken_since as string }
                : null,
            tags: row.tags ? JSON.parse(row.tags as string) : [],
        };
    }
    return out;
}

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

        if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (!url.pathname.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        // GET /api/overlay - public read, used at site build time (generate-site.mjs) and by the
        // admin plugin/site to show current values before editing.
        if (url.pathname === "/api/overlay" && request.method === "GET") {
            const cached = await env.OVERLAY_CACHE.get(CACHE_KEY, "json");
            if (cached) return json(cached);

            const data = await readAll(env.DB);
            await env.OVERLAY_CACHE.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: CACHE_TTL_SECONDS });
            return json(data);
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

                await env.DB.prepare(
                    `INSERT INTO overlay (id, status, broken_reason, broken_since, tags, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(id) DO UPDATE SET
                         status = excluded.status,
                         broken_reason = excluded.broken_reason,
                         broken_since = excluded.broken_since,
                         tags = excluded.tags,
                         updated_at = excluded.updated_at`,
                ).bind(
                    id,
                    body.status ?? null,
                    body.broken?.reason ?? null,
                    body.broken ? (body.broken.since ?? new Date().toISOString()) : null,
                    JSON.stringify(body.tags ?? []),
                    new Date().toISOString(),
                ).run();

                await env.OVERLAY_CACHE.delete(CACHE_KEY);
                return json({ ok: true });
            }

            if (request.method === "DELETE") {
                await env.DB.prepare("DELETE FROM overlay WHERE id = ?1").bind(id).run();
                await env.OVERLAY_CACHE.delete(CACHE_KEY);
                return json({ ok: true });
            }
        }

    return json({ error: "not found" }, 404);
}
