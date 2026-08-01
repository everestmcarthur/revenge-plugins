import { readFile, writeFile, readdir, copyFile, stat } from "fs/promises";

const PAGES_BASE = "https://everestmcarthur.github.io/revenge-plugins";
const REPO_BASE = "https://github.com/everestmcarthur/revenge-plugins";

const meta = JSON.parse(await readFile("./site/meta.json", "utf8"));
const plugins = [];

for (const id of await readdir("./dist")) {
    const dir = `./dist/${id}`;
    if (!(await stat(dir)).isDirectory()) continue;

    let manifest;
    try {
        manifest = JSON.parse(await readFile(`${dir}/manifest.json`, "utf8"));
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
        installUrl: `${PAGES_BASE}/${id}/`,
        sourceUrl: `${REPO_BASE}/tree/main/plugins/${id}`,
        issueUrl: `${REPO_BASE}/issues/new?title=${encodeURIComponent(`[${manifest.name}] `)}`
    });
}

plugins.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

await writeFile("./dist/plugins-data.json", JSON.stringify(plugins, null, 2));
await copyFile("./site/index.html", "./dist/index.html");
await copyFile("./site/index.html", "./dist/404.html");

console.log(`Generated site data for ${plugins.length} plugin(s).`);
