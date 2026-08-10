import { readFile, writeFile, readdir, copyFile, stat } from "fs/promises";

const PAGES_BASE = "https://rp.jarviscli.dev";
const REPO_BASE = "https://github.com/everestmcarthur/revenge-plugins";

const meta = JSON.parse(await readFile("./site/meta.json", "utf8"));
const plugins = [];

// This file intentionally does NOT merge in the live overlay (status/broken/tags) anymore - that
// used to happen here at build time, which meant flipping something broken from the admin plugin
// only showed up on the site after the next git push. The Worker (api/src/index.ts) now merges
// plugins-base.json (written below, git-tracked content only) with the live overlay on every
// request to /plugins-data.json, so admin changes are visible immediately with no rebuild needed.
for (const id of await readdir("./dist")) {
    const dir = `./dist/${id}`;
    if (!(await stat(dir)).isDirectory()) continue;

    let manifest;
    try {
        manifest = JSON.parse(await readFile(`${dir}/install/manifest.json`, "utf8"));
    } catch {
        continue; // not a plugin output directory
    }

    const info = meta[id] ?? {};

    plugins.push({
        id,
        name: manifest.name,
        description: manifest.description,
        authors: (manifest.authors ?? []).map((a) => a.name),
        category: info.category ?? "Other",
        status: info.status ?? "new",
        accent: info.accent ?? "#5865f2",
        tagline: info.tagline ?? manifest.description,
        note: info.note ?? "",
        howItWorks: info.howItWorks ?? "",
        features: info.features ?? [],
        commands: info.commands ?? [],
        limitations: info.limitations ?? "",
        pageUrl: `${PAGES_BASE}/${id}/`,
        installUrl: `${PAGES_BASE}/${id}/install/`,
        sourceUrl: `${REPO_BASE}/tree/main/plugins/${id}`,
        issueUrl: `${REPO_BASE}/issues/new?title=${encodeURIComponent(`[${manifest.name}] `)}`
    });
}

plugins.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

await writeFile("./dist/plugins-base.json", JSON.stringify(plugins, null, 2));
await copyFile("./site/index.html", "./dist/index.html");
await copyFile("./site/index.html", "./dist/404.html");
await copyFile("./site/CNAME", "./dist/CNAME");

// Each plugin gets its own real, bookmarkable page at /<id>/ (not just a hash route) - it's the
// same SPA shell, which reads location.pathname on boot to know which plugin to show directly.
for (const p of plugins) {
    await copyFile("./site/index.html", `./dist/${p.id}/index.html`);
}

// Static install files (manifest.json / index.js) are served directly by the Workers Assets layer,
// bypassing the Worker code, so CORS headers must be attached here.
const headers = `/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, PUT, DELETE, OPTIONS, PATCH
  Access-Control-Allow-Headers: authorization, content-type
  Access-Control-Max-Age: 86400
  Vary: Origin
`;
await writeFile("./dist/_headers", headers);

console.log(`Generated site data for ${plugins.length} plugin(s).`);
