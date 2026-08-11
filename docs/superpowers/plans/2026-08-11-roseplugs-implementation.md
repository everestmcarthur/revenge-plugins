# RosePlugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build RosePlugs, a new Revenge/Vendetta plugin that adds a top-level "Rosie's Plugs" settings section containing a quick-install browser for Rosie's plugins plus a direct settings shortcut for each of Rosie's plugins that's currently installed.

**Architecture:** A single self-contained plugin in `/root/revenge-plugins/plugins/rose-plugs/`. Two patch mechanisms adapted from Raiden's Themes' already-shipping `SETTING_RENDERER_CONFIG`/`createList` pattern (inserting a whole new section object instead of appending a row to an existing one), plus a discovery function that reads `@vendetta/plugins`' `plugins` record to find Rosie-authored installed plugins, plus a quick-install browser UI backed by the live Nexus JSON API.

**Tech Stack:** TypeScript, React (via `@vendetta/metro/common`), React Native components, Vendetta/Revenge plugin APIs (`@vendetta/plugins`, `@vendetta/metro`, `@vendetta/patcher`, `@vendetta/ui/*`), this repo's Rollup+SWC build (`build.mjs`), GitHub Actions + Cloudflare Workers deploy, revenge-devtools MCP for live verification.

## Global Constraints

- Plugin directory: `plugins/rose-plugs/` (kebab-case, matches every other plugin in this repo). No registration step needed — `build.mjs` auto-discovers every directory under `plugins/`.
- Manifest: id `rose-plugs`, name `RosePlugs`, author `Rosie`, `main: "src/index.ts"`.
- Section label/title inserted into Settings: label `ROSES_PLUGS`, title `Rosie's Plugs` (exact string).
- `@vendetta/plugins`' `plugins` record is keyed by the plugin's full install-source URL (e.g. `https://rp.jarviscli.dev/server-drawer/install/`), **not** a short id. Every lookup against it must use the full URL.
- `getSettings(id)` returns a component **function**, confirmed live — despite `vendetta-types`' `.d.ts` claiming it returns `JSX.Element`. Always check `typeof result === "function"` before using it, and wrap with `React.createElement(Component)` when rendering it — never call it directly or treat the return value as an already-built element.
- Discovery filter is `manifest.authors` containing an author named exactly `"Rosie"` (confirmed via live test: catches 17 of this repo's plugins; deliberately excludes Raiden's Themes, whose manifest credits "Raiden", and RP Admin, whose manifest credits "everestmcarthur" — both exclusions are intentional per user decision, not bugs to fix).
- Nexus plugin metadata: `GET https://rp.jarviscli.dev/plugins-data.json`, an array of objects shaped exactly like `NexusPlugin` in Task 5.
- Every task's deploy/verify steps use this repo's standard flow: `npm run build` locally first (catches TS/bundle errors before any push) → commit → `git push origin main` → `gh run watch <run-id> --exit-status` → purge Cloudflare cache for zone `76e85aab7728490e7f6351ac7b8b176f` via the `cloudflare-api` MCP tool (`POST /zones/76e85aab7728490e7f6351ac7b8b176f/purge_cache` with `{"purge_everything": true}`) → live-verify via the `revenge-devtools` MCP (`devtools_clients` to confirm a client is connected, `eval`/`get_logs` to confirm actual behavior). No task is done on a "should work" basis — confirm it live before checking the box.
- Reopening a live client's Settings screen (navigate out, then back in) is enough to get a fresh `createList` call — confirmed directly in this session by capturing a live call. A full app reload is not required to see settings changes.
- The new section is inserted at the very top of Settings (`sections.unshift(...)`, not anchored next to any existing section) — confirmed live via a scratch `eval` patch before Task 2 was written; the user explicitly asked for top placement after seeing an end-anchored version first.
- Code comments only where the *why* is genuinely non-obvious (a confirmed live quirk, a workaround). Never comment what the code visibly does.

---

### Task 1: Scaffold the plugin

**Files:**
- Create: `plugins/rose-plugs/manifest.json`
- Create: `plugins/rose-plugs/src/index.ts`
- Create: `plugins/rose-plugs/src/ui/Settings.tsx`

**Interfaces:**
- Produces: a buildable, installable plugin with a no-op `onLoad`/`onUnload` and a real `settings` export, reachable the normal way through Revenge's own Plugins list. Nothing here yet inserts the new section — that's Task 2.

- [ ] **Step 1: Create the manifest**

`plugins/rose-plugs/manifest.json`:
```json
{
    "name": "RosePlugs",
    "description": "Gives Rosie's plugins their own home in Settings, with one-tap installs for anything not installed yet.",
    "authors": [
        { "name": "Rosie" }
    ],
    "main": "src/index.ts",
    "vendetta": {
        "icon": "ic_group"
    }
}
```

- [ ] **Step 2: Create the placeholder settings screen**

`plugins/rose-plugs/src/ui/Settings.tsx`:
```tsx
import { React } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";

export default function Settings() {
    return (
        <SettingsScaffold>
            <NoteBox>
                RosePlugs gathers Rosie's other plugins under their own "Rosie's Plugs" section in
                Settings, with a quick-install browser for anything not installed yet.
            </NoteBox>
        </SettingsScaffold>
    );
}
```

- [ ] **Step 3: Create the plugin entry point**

`plugins/rose-plugs/src/index.ts`:
```ts
import Settings from "./ui/Settings";

export default {
    onLoad: () => {},
    onUnload: () => {},
    settings: Settings,
};
```

- [ ] **Step 4: Build locally**

Run: `cd /root/revenge-plugins && npm run build`
Expected: `Successfully built RosePlugs!` appears in the output alongside every other plugin, no errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/rose-plugs
git commit -m "RosePlugs: scaffold plugin"
```

- [ ] **Step 6: Push and deploy**

```bash
git push origin main
gh run list --limit 1
```
Then watch the run: `gh run watch <run-id> --exit-status` (use the run id from the previous command).

- [ ] **Step 7: Purge the Cloudflare cache**

Use the `cloudflare-api` MCP tool to `POST /zones/76e85aab7728490e7f6351ac7b8b176f/purge_cache` with `{"purge_everything": true}`.

- [ ] **Step 8: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm a client is connected.
2. Install RosePlugs on the connected device via Revenge's Settings → Plugins → Add Plugin, using the install URL `https://rp.jarviscli.dev/rose-plugs/install/`.
3. Confirm it appears in Revenge's own Plugins list, doesn't crash on load, and tapping into its settings shows the NoteBox text from Step 2.

---

### Task 2: Section-insertion mechanism, proven with a stub row

**Files:**
- Create: `plugins/rose-plugs/src/patches/settings.ts`
- Modify: `plugins/rose-plugs/src/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface SectionRow { key: string; title: () => string; icon?: any; page: React.ComponentType<any>; }`
  - `export default function patchRosiesPlugsSection(getRows: () => SectionRow[]): () => void` — installs both settings-surface patches, returns a cleanup function. `getRows` is called fresh every time the section is rendered, so the row list can change over time (new plugins installed, etc.) without needing a plugin reload.

This is adapted directly from `plugins/raidens-themes/src/patches/settings.ts` (already live-verified, shipping). The difference: Raiden's Themes finds the "Revenge" section and pushes one row into its existing `settings` array. This inserts a **whole new section object** as a sibling of that section instead.

- [ ] **Step 1: Write the section-insertion patch**

`plugins/rose-plugs/src/patches/settings.ts`:
```ts
import { React, NavigationNative } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

const { FormSection, FormRow } = Forms;

const SECTION_LABEL = "ROSES_PLUGS";
const SECTION_TITLE = "Rosie's Plugs";

const tabsNavigationRef = findByProps("getRootNavigationRef");
const settingConstants = findByProps("SETTING_RENDERER_CONFIG");
const createListModule = findByProps("createList");
const SettingsOverviewScreen = findByName("SettingsOverviewScreen", false);
const TableRowIconModule = findByProps("TableRowIcon");

export interface SectionRow {
    key: string;
    title: () => string;
    icon?: any;
    page: React.ComponentType<any>;
}

function navigateToRow(row: SectionRow) {
    const navigation = tabsNavigationRef.getRootNavigationRef();
    const Component = row.page;
    navigation.navigate("VendettaCustomPage", {
        title: row.title(),
        render: () => React.createElement(Component),
    });
}

function buildRendererRow(row: SectionRow) {
    return {
        type: "pressable",
        useTitle: row.title,
        title: row.title,
        icon: row.icon,
        IconComponent:
            row.icon && TableRowIconModule &&
            (() => React.createElement(TableRowIconModule.TableRowIcon, { source: row.icon })),
        onPress: () => navigateToRow(row),
        withArrow: true,
    };
}

function Section({ tabs }: { tabs: SectionRow }) {
    const navigation = NavigationNative.useNavigation();

    return React.createElement(FormRow, {
        label: tabs.title(),
        leading: tabs.icon ? React.createElement(FormRow.Icon, { source: tabs.icon }) : undefined,
        trailing: React.createElement(FormRow.Arrow),
        onPress: () => {
            const Component = tabs.page;
            navigation.navigate("VendettaCustomPage", {
                title: tabs.title(),
                render: () => React.createElement(Component),
            });
        },
    });
}

function patchPanelUI(getRows: () => SectionRow[], patches: (() => void)[]) {
    const target = findByProps("renderTitle", "sections");
    if (!target) return;

    try {
        patches.push(
            after("default", target, (_: any, ret: any) => {
                const UserSettingsOverview = findInReactTree(
                    ret.props.children,
                    (n: any) => n.type?.name === "UserSettingsOverview"
                );

                if (UserSettingsOverview) {
                    patches.push(
                        after("render", UserSettingsOverview.type.prototype, (_args: any, res: any) => {
                            const sections = findInReactTree(
                                res.props.children,
                                (n: any) => n?.children?.[1]?.type === FormSection
                            )?.children;

                            if (sections) {
                                const rows = getRows();
                                rows.forEach((row, i) => {
                                    sections.splice(
                                        i,
                                        0,
                                        React.createElement(Section, { key: row.key, tabs: row })
                                    );
                                });
                            }
                        }, true)
                    );
                }
            }, true)
        );
    } catch {
        // This surface (the tablet/desktop-style settings panel) may not exist on this build at
        // all - patchTabsUI below covers the mobile settings list, which is what actually matters.
    }
}

function patchTabsUI(getRows: () => SectionRow[], patches: (() => void)[]) {
    if (!settingConstants || !tabsNavigationRef) {
        console.warn("[RosePlugs] Missing constants for tabs UI patch");
        return;
    }

    let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
        enumerable: true,
        configurable: true,
        get: () => {
            const extra: Record<string, any> = {};
            for (const row of getRows()) extra[row.key] = buildRendererRow(row);
            return { ...rendererConfigValue, ...extra };
        },
        set(v: any) { rendererConfigValue = v; },
    });

    const firstRender = Symbol("roseplugs-first-render");

    try {
        if (!createListModule) return;
        patches.push(
            after("createList", createListModule, function (args: any) {
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const [config] = args;
                const sections = config.sections;
                const rows = getRows();
                if (!rows.length || !sections) return;

                sections.unshift({ label: SECTION_LABEL, title: SECTION_TITLE, settings: rows.map((r) => r.key) });
            })
        );
    } catch {
        if (!SettingsOverviewScreen) return;
        patches.push(
            after("default", SettingsOverviewScreen, (args: any, ret: any) => {
                if (args[0][firstRender]) return;
                args[0][firstRender] = true;

                const { sections } = findInReactTree(ret, (i: any) => i.props?.sections)?.props ?? {};
                const rows = getRows();
                if (!rows.length || !sections) return;

                sections.unshift({ label: SECTION_LABEL, title: SECTION_TITLE, settings: rows.map((r) => r.key) });
            })
        );
    }
}

export default function patchRosiesPlugsSection(getRows: () => SectionRow[]): () => void {
    const patches: (() => void)[] = [];

    patchPanelUI(getRows, patches);
    patchTabsUI(getRows, patches);

    return () => {
        for (const p of patches) p?.();
    };
}
```

- [ ] **Step 2: Wire a stub row into the plugin entry point**

Replace `plugins/rose-plugs/src/index.ts`:
```ts
import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";

let unpatch: (() => void) | undefined;

function StubPluginsScreen() {
    return null;
}

function buildRows(): SectionRow[] {
    return [
        {
            key: "ROSES_PLUGS_STUB",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: StubPluginsScreen,
        },
    ];
}

export default {
    onLoad: () => {
        try {
            unpatch = patchRosiesPlugsSection(buildRows);
        } catch (e: any) {
            logger.error("[RosePlugs] Failed to patch settings:", e?.message ?? e);
        }
    },
    onUnload: () => {
        unpatch?.();
        unpatch = undefined;
    },
    settings: Settings,
};
```

- [ ] **Step 3: Build locally**

Run: `cd /root/revenge-plugins && npm run build`
Expected: `Successfully built RosePlugs!`, no errors.

- [ ] **Step 4: Commit, push, deploy, purge**

```bash
git add plugins/rose-plugs
git commit -m "RosePlugs: insert a new top-level settings section"
git push origin main
```
Watch the deploy with `gh run watch <run-id> --exit-status`, then purge the Cloudflare cache (zone `76e85aab7728490e7f6351ac7b8b176f`, same as Task 1 Step 7).

- [ ] **Step 5: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. On the device, back all the way out of Settings, then reopen it (confirmed sufficient to force a fresh `createList` call — no full app reload needed).
3. Confirm a "Rosie's Plugs" section header appears at the very top of Settings (above Account Settings), with a single "Plugins" row under it — this exact placement was already confirmed live via a scratch `eval` patch before this task was written; this step is re-confirming it against the real committed code.
4. Tap the row — confirm it navigates to a blank screen without crashing (the stub).
5. Use `eval` to double check no duplicate section was inserted: reopen Settings once more and confirm still exactly one "Rosie's Plugs" header, not two — this is what the `firstRender` symbol guard is protecting against.

---

### Task 3: Discover Rosie's other installed plugins

**Files:**
- Create: `plugins/rose-plugs/src/patches/discoverPlugins.ts`
- Modify: `plugins/rose-plugs/src/index.ts` (temporary logging only, removed in Task 4)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface DiscoveredPlugin { id: string; name: string; icon?: string; settingsComponent: (() => any) | null; }`
  - `export function discoverRosiesPlugins(): DiscoveredPlugin[]` — every installed plugin whose manifest lists an author named "Rosie", excluding RosePlugs itself, sorted alphabetically by name. `settingsComponent` is the plugin's own settings component (from `getSettings`) when it has one, otherwise `null`.

- [ ] **Step 1: Write the discovery function**

`plugins/rose-plugs/src/patches/discoverPlugins.ts`:
```ts
import { plugins as installedPlugins, getSettings } from "@vendetta/plugins";

export interface DiscoveredPlugin {
    id: string;
    name: string;
    icon?: string;
    settingsComponent: (() => any) | null;
}

export function discoverRosiesPlugins(): DiscoveredPlugin[] {
    const result: DiscoveredPlugin[] = [];

    for (const id in installedPlugins) {
        const plugin = installedPlugins[id];
        const manifest = plugin?.manifest;
        if (!manifest || manifest.name === "RosePlugs") continue;

        const authors = manifest.authors ?? [];
        if (!authors.some((a: any) => a.name === "Rosie")) continue;

        let settingsComponent: (() => any) | null = null;
        try {
            const settingsResult = getSettings(id);
            if (typeof settingsResult === "function") settingsComponent = settingsResult;
        } catch {
            settingsComponent = null;
        }

        result.push({ id, name: manifest.name, icon: manifest.vendetta?.icon, settingsComponent });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 2: Temporarily log the discovery result**

In `plugins/rose-plugs/src/index.ts`, add this import and line inside `onLoad`, right after the existing `try {`:
```ts
import { discoverRosiesPlugins } from "./patches/discoverPlugins";
```
```ts
console.log(
    "[RosePlugs] discovered:",
    JSON.stringify(discoverRosiesPlugins().map((p) => ({ id: p.id, name: p.name, hasSettings: !!p.settingsComponent })))
);
```

- [ ] **Step 3: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: discover Rosie's other installed plugins"`.

- [ ] **Step 4: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. Fully reload the Discord app (so `onLoad` runs fresh and the log fires).
3. `get_logs` — find the `[RosePlugs] discovered:` line and confirm it lists plugins with `manifest.authors` including "Rosie" (compare against the known live list from this session's design phase: role-color-everywhere, message-snippets, custom-user-tags, view-raw, better-timestamps, radial-status, reverse-image-search, you-bar-plus, urban-dictionary, staff-tags, rose-utils, key-inspector, copy-role-color, typing-avatars, pronoun-db, fake-profile-themes-and-effects, server-drawer — the exact live count may have changed since then, so treat that list as "should roughly match," not an exact assertion).
4. Confirm Raiden's Themes and RP Admin are **not** in the list (expected exclusions).
5. Spot check 2-3 entries' `hasSettings` value against whether that plugin actually has a settings screen in Revenge's own Plugins list, to sanity check the `getSettings` typeof-function check is working correctly both ways (true and false cases).

- [ ] **Step 5: Remove the temporary log line**

Delete the `console.log("[RosePlugs] discovered:", ...)` call added in Step 2 — its job was proving the discovery function works before wiring it into real UI in Task 4. Leave the import; Task 4 uses it too.

```bash
git add plugins/rose-plugs/src/index.ts
git commit -m "RosePlugs: remove temporary discovery log"
```
(No redeploy needed yet — Task 4 will deploy this together with the real row-wiring change.)

---

### Task 4: Wire discovered plugins into real settings rows

**Files:**
- Modify: `plugins/rose-plugs/src/index.ts`

**Interfaces:**
- Consumes: `SectionRow` and `patchRosiesPlugsSection` from Task 2's `patches/settings.ts`; `discoverRosiesPlugins` from Task 3's `patches/discoverPlugins.ts`.
- Produces: the real `buildRows()` used for the rest of this plan — "Plugins" (still a stub page until Task 6) followed by one row per discovered plugin that has settings.

- [ ] **Step 1: Replace the stub row list with real rows**

Replace `plugins/rose-plugs/src/index.ts`:
```ts
import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";
import { discoverRosiesPlugins } from "./patches/discoverPlugins";

let unpatch: (() => void) | undefined;

function StubPluginsScreen() {
    return null;
}

function buildRows(): SectionRow[] {
    const rows: SectionRow[] = [
        {
            key: "ROSES_PLUGS_BROWSER",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: StubPluginsScreen,
        },
    ];

    for (const plugin of discoverRosiesPlugins()) {
        if (!plugin.settingsComponent) continue;
        rows.push({
            key: `ROSES_PLUGS_${plugin.id}`,
            title: () => plugin.name,
            page: plugin.settingsComponent as any,
        });
    }

    return rows;
}

export default {
    onLoad: () => {
        try {
            unpatch = patchRosiesPlugsSection(buildRows);
        } catch (e: any) {
            logger.error("[RosePlugs] Failed to patch settings:", e?.message ?? e);
        }
    },
    onUnload: () => {
        unpatch?.();
        unpatch = undefined;
    },
    settings: Settings,
};
```

- [ ] **Step 2: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: replace stub row with discovered plugin settings rows"`.

- [ ] **Step 3: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. Back out of Settings and reopen it.
3. Confirm "Rosie's Plugs" now lists "Plugins" plus a row for every discovered plugin with settings — names should read like "ServerDrawer", "TypingAvatars", etc., not raw ids or URLs.
4. Tap the "ServerDrawer" row — confirm it opens ServerDrawer's real settings screen (the "Hide the DMs tile" / "Show server names" toggles from earlier this session should be visible).
5. Tap one more plugin's row (pick any with a real settings screen) and confirm it opens correctly too.
6. Tap "Plugins" — still the blank stub for now, confirm no crash.

---

### Task 5: Nexus plugin metadata fetch + cache

**Files:**
- Create: `plugins/rose-plugs/src/lib/nexusApi.ts`
- Modify: `plugins/rose-plugs/src/index.ts` (temporary logging only, removed in Task 6)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface NexusPlugin { id: string; name: string; description: string; authors: string[]; category: string; status: string; accent: string; tagline: string; note: string; howItWorks: string; features: string[]; commands: string[]; limitations: string; pageUrl: string; installUrl: string; sourceUrl: string; issueUrl: string; }`
  - `export async function fetchNexusPlugins(force?: boolean): Promise<NexusPlugin[]>` — fetches `https://rp.jarviscli.dev/plugins-data.json`, caches the result in memory for the session, dedupes concurrent calls into a single in-flight request. `force: true` bypasses the cache.
  - `export function clearNexusCache(): void` — drops the in-memory cache so the next `fetchNexusPlugins()` call re-fetches.

- [ ] **Step 1: Write the fetch/cache module**

`plugins/rose-plugs/src/lib/nexusApi.ts`:
```ts
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
```

- [ ] **Step 2: Temporarily log a live fetch result**

In `plugins/rose-plugs/src/index.ts`, add this import:
```ts
import { fetchNexusPlugins } from "./lib/nexusApi";
```
And this line inside `onLoad`, after the existing patch call:
```ts
fetchNexusPlugins()
    .then((list) => console.log("[RosePlugs] nexus fetch ok:", list.length, JSON.stringify(list[0])))
    .catch((e) => console.log("[RosePlugs] nexus fetch failed:", String(e)));
```

- [ ] **Step 3: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: fetch and cache Nexus plugin metadata"`.

- [ ] **Step 4: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. Fully reload the Discord app.
3. `get_logs` — find `[RosePlugs] nexus fetch ok:` with a real count (should roughly match the number of plugins in this repo, currently around 20) and a real first plugin's JSON (recognizable `name`/`category`/`installUrl` fields, not placeholder or malformed data). If it logs `nexus fetch failed` instead, that's a real bug to fix before moving on — this confirms `fetch` actually works from inside the RN app against this specific host, not just in theory.

- [ ] **Step 5: Remove the temporary log lines**

Delete the `fetchNexusPlugins().then(...).catch(...)` block added in Step 2. Leave the import — Task 6 uses it.

```bash
git add plugins/rose-plugs/src/index.ts
git commit -m "RosePlugs: remove temporary nexus fetch log"
```
(No redeploy needed yet — Task 6 deploys this together with the real browser UI.)

---

### Task 6: Quick-install browser UI

**Files:**
- Create: `plugins/rose-plugs/src/ui/PluginDetailSheet.tsx`
- Create: `plugins/rose-plugs/src/ui/PluginsBrowser.tsx`
- Modify: `plugins/rose-plugs/src/index.ts`

**Interfaces:**
- Consumes: `NexusPlugin`/`fetchNexusPlugins` from Task 5's `lib/nexusApi.ts`; `plugins`/`installPlugin` from `@vendetta/plugins`; `showCustomAlert` from `@vendetta/ui/alerts`; `showToast` from `@vendetta/ui/toasts`; `PrimaryButton`/`TableRow`/`TableRowGroup`/`SettingsScaffold`/`NoteBox` from `@shared/ui/*`.
- Produces: `PluginsBrowser` (default export, no props) and `PluginDetailSheet` (default export, props `{ plugin: NexusPlugin }`) — replaces `StubPluginsScreen` as the "Plugins" row's page.

- [ ] **Step 1: Write the detail/install sheet**

`plugins/rose-plugs/src/ui/PluginDetailSheet.tsx`:
```tsx
import { React, ReactNative } from "@vendetta/metro/common";
import { plugins as installedPlugins, installPlugin } from "@vendetta/plugins";
import { showToast } from "@vendetta/ui/toasts";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { NexusPlugin } from "../lib/nexusApi";

const { ScrollView, Text } = ReactNative;

export default function PluginDetailSheet({ plugin }: { plugin: NexusPlugin }) {
    const [installing, setInstalling] = React.useState(false);
    const alreadyInstalled = plugin.installUrl in installedPlugins;

    const onInstall = React.useCallback(() => {
        setInstalling(true);
        installPlugin(plugin.installUrl)
            .then(() => {
                setInstalling(false);
                showToast(`${plugin.name} installed`);
            })
            .catch((e: any) => {
                setInstalling(false);
                showToast(`Install failed: ${e?.message ?? e}`);
            });
    }, [plugin.installUrl]);

    return (
        <ScrollView style={{ maxHeight: 400, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{plugin.name}</Text>
            <Text style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{plugin.category}</Text>
            <Text style={{ fontSize: 14, marginBottom: 16 }}>{plugin.tagline || plugin.description}</Text>
            {plugin.status && plugin.status !== "default" && (
                <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 16 }}>
                    {plugin.status.toUpperCase()}
                </Text>
            )}
            <PrimaryButton
                label={alreadyInstalled ? "Installed" : installing ? "Installing…" : "Install"}
                disabled={alreadyInstalled || installing}
                onPress={onInstall}
            />
        </ScrollView>
    );
}
```

- [ ] **Step 2: Write the browser screen**

`plugins/rose-plugs/src/ui/PluginsBrowser.tsx`:
```tsx
import { React, ReactNative } from "@vendetta/metro/common";
import { plugins as installedPlugins } from "@vendetta/plugins";
import { showCustomAlert } from "@vendetta/ui/alerts";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { TableRow, TableRowGroup } from "@shared/ui/table";
import { fetchNexusPlugins, NexusPlugin } from "../lib/nexusApi";
import PluginDetailSheet from "./PluginDetailSheet";

const { Text } = ReactNative;

interface BrowserState {
    loading: boolean;
    error: string | null;
    plugins: NexusPlugin[];
}

export default function PluginsBrowser() {
    const [state, setState] = React.useState<BrowserState>({ loading: true, error: null, plugins: [] });

    const load = React.useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: null }));
        fetchNexusPlugins()
            .then((plugins) => setState({ loading: false, error: null, plugins }))
            .catch((e) => setState({ loading: false, error: String(e?.message ?? e), plugins: [] }));
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    if (state.loading) {
        return (
            <SettingsScaffold>
                <NoteBox>Loading Rosie's plugins…</NoteBox>
            </SettingsScaffold>
        );
    }

    if (state.error) {
        return (
            <SettingsScaffold>
                <NoteBox>Couldn't load the plugin list: {state.error}</NoteBox>
                <PrimaryButton label="Retry" onPress={load} style={{ margin: 16 }} />
            </SettingsScaffold>
        );
    }

    const byCategory = new Map<string, NexusPlugin[]>();
    for (const plugin of state.plugins) {
        const list = byCategory.get(plugin.category) ?? [];
        list.push(plugin);
        byCategory.set(plugin.category, list);
    }

    return (
        <SettingsScaffold>
            {[...byCategory.entries()].map(([category, plugins]) => (
                <TableRowGroup key={category} title={category}>
                    {plugins.map((plugin) => {
                        const installed = plugin.installUrl in installedPlugins;
                        return (
                            <TableRow
                                key={plugin.id}
                                label={plugin.name}
                                subLabel={installed ? "Installed" : plugin.tagline || plugin.description}
                                trailing={
                                    plugin.status && plugin.status !== "default" ? (
                                        <Text style={{ fontSize: 11, fontWeight: "700", opacity: 0.7 }}>
                                            {plugin.status.toUpperCase()}
                                        </Text>
                                    ) : installed ? (
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#23A55A" }}>✓</Text>
                                    ) : undefined
                                }
                                onPress={() => showCustomAlert(PluginDetailSheet, { plugin })}
                            />
                        );
                    })}
                </TableRowGroup>
            ))}
        </SettingsScaffold>
    );
}
```

- [ ] **Step 3: Wire the real browser into the section, remove the stub**

In `plugins/rose-plugs/src/index.ts`: remove the `fetchNexusPlugins` import and the temporary log block if not already removed in Task 5 Step 5; remove the `StubPluginsScreen` function; import and use the real screen instead:
```ts
import { logger } from "@vendetta";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./ui/Settings";
import PluginsBrowser from "./ui/PluginsBrowser";
import patchRosiesPlugsSection, { SectionRow } from "./patches/settings";
import { discoverRosiesPlugins } from "./patches/discoverPlugins";

let unpatch: (() => void) | undefined;

function buildRows(): SectionRow[] {
    const rows: SectionRow[] = [
        {
            key: "ROSES_PLUGS_BROWSER",
            title: () => "Plugins",
            icon: getAssetIDByName("SettingsIcon"),
            page: PluginsBrowser,
        },
    ];

    for (const plugin of discoverRosiesPlugins()) {
        if (!plugin.settingsComponent) continue;
        rows.push({
            key: `ROSES_PLUGS_${plugin.id}`,
            title: () => plugin.name,
            page: plugin.settingsComponent as any,
        });
    }

    return rows;
}

export default {
    onLoad: () => {
        try {
            unpatch = patchRosiesPlugsSection(buildRows);
        } catch (e: any) {
            logger.error("[RosePlugs] Failed to patch settings:", e?.message ?? e);
        }
    },
    onUnload: () => {
        unpatch?.();
        unpatch = undefined;
    },
    settings: Settings,
};
```

- [ ] **Step 4: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: build the quick-install browser"`.

- [ ] **Step 5: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. Back out of Settings and reopen it, navigate to Rosie's Plugs → Plugins.
3. Confirm real category headers and plugin rows render (not blank), matching the live Nexus JSON (cross-check with a fresh `eval` call doing `fetch("https://rp.jarviscli.dev/plugins-data.json").then(r => r.json())` and comparing counts/names).
4. Confirm already-installed plugins show a green ✓ or "Installed" sublabel; confirm any non-default `status` values show as an uppercase badge.
5. Tap a plugin row — confirm `PluginDetailSheet` opens with the right name/category/tagline.
6. Find a plugin in the Nexus catalog that is **not** in this device's installed list (compare against the live `plugins` record from `@vendetta/plugins`) and tap Install on it. Confirm the button shows "Installing…" then success, and via `eval` confirm `plugin.installUrl in window.vendetta.plugins.plugins` is now `true`. If every catalog plugin happens to already be installed on this test device, install-testing an already-installed one is acceptable too — the goal is confirming `installPlugin` fires without error and the button states transition correctly, not necessarily a net-new install.

---

### Task 7: RosePlugs' own settings screen

**Files:**
- Modify: `plugins/rose-plugs/src/ui/Settings.tsx`

**Interfaces:**
- Consumes: `clearNexusCache` from Task 5's `lib/nexusApi.ts`.
- Produces: nothing new consumed elsewhere — this is RosePlugs' own settings screen, reached normally via Revenge's Plugins list (not via a row inside Rosie's Plugs itself).

- [ ] **Step 1: Add the refresh button**

Replace `plugins/rose-plugs/src/ui/Settings.tsx`:
```tsx
import { React } from "@vendetta/metro/common";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { showToast } from "@vendetta/ui/toasts";
import { clearNexusCache } from "../lib/nexusApi";

export default function Settings() {
    return (
        <SettingsScaffold>
            <NoteBox>
                RosePlugs gathers Rosie's other plugins under their own "Rosie's Plugs" section in
                Settings, with a quick-install browser for anything not installed yet.
            </NoteBox>
            <PrimaryButton
                label="Refresh plugin list"
                onPress={() => {
                    clearNexusCache();
                    showToast("Plugin list will refresh next time you open Plugins");
                }}
                style={{ margin: 16 }}
            />
        </SettingsScaffold>
    );
}
```

- [ ] **Step 2: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: add refresh button to its own settings"`.

- [ ] **Step 3: Live-verify**

Via `revenge-devtools`:
1. `devtools_clients` — confirm connected.
2. Open Settings → Plugins (Revenge's own list) → RosePlugs → Settings.
3. Confirm the NoteBox text and "Refresh plugin list" button render.
4. Open Plugins (Rosie's Plugs → Plugins) once first, to populate the cache, then go back to RosePlugs' own settings and tap "Refresh plugin list" — confirm the toast appears.
5. Reopen Rosie's Plugs → Plugins and confirm it still loads correctly (a fresh fetch after the cache-bust, not a crash or stale/empty state).

---

### Task 8: Nexus metadata entry and final end-to-end sweep

**Files:**
- Modify: `site/meta.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is polish plus a final full-system verification pass.

- [ ] **Step 1: Add a `site/meta.json` entry for rose-plugs**

Open `site/meta.json`, add an entry keyed `"rose-plugs"` alongside the existing entries, following the same shape as the other entries read in Task's earlier exploration (`category`, `status`, `accent`, `tagline`, `note`, `howItWorks`, `features`, `commands`, `limitations` — all optional, defaults exist in `scripts/generate-site.mjs` for anything omitted):
```json
"rose-plugs": {
    "category": "Utility",
    "status": "new",
    "accent": "#F47FFF",
    "tagline": "A home of Rosie's own in Settings, with one-tap installs for anything not installed yet.",
    "howItWorks": "Adds a \"Rosie's Plugs\" section to Discord's Settings, separate from Revenge's own Plugins list. Its first entry, \"Plugins,\" is a quick-install browser pulling live from this site's own plugin catalog. Every other Rosie-authored plugin that's currently installed gets a direct settings shortcut listed right below it.",
    "features": [
        "New top-level \"Rosie's Plugs\" settings section",
        "One-tap install browser for every plugin in this catalog, grouped by category",
        "Direct settings shortcuts for each installed Rosie-authored plugin - no digging through Revenge's own Plugins list"
    ],
    "commands": [],
    "limitations": "Only surfaces plugins whose manifest lists \"Rosie\" as an author - a plugin credited to someone else won't be picked up automatically."
}
```
Adjust `category`/`accent` if inconsistent with this repo's existing category naming once you read the full `site/meta.json` file - match whatever categories already exist rather than inventing a new one, unless none fit.

- [ ] **Step 2: Build, commit, push, deploy, purge**

Same sequence as Task 2 Step 3-4. Commit message: `"RosePlugs: add Nexus site metadata"`.

- [ ] **Step 3: Full end-to-end live-verify**

Via `revenge-devtools`, working through the spec's testing checklist in full:
1. `devtools_clients` — confirm connected.
2. "Rosie's Plugs" section appears in Settings, correctly positioned and titled.
3. "Plugins" row opens the browser with real, categorized, correctly-badged data.
4. Installing a not-yet-installed plugin actually installs it (repeat Task 6 Step 5's install check if not already covered by a genuinely new plugin at that point).
5. Every already-installed Rosie-authored plugin with settings shows a row that opens the correct screen (spot-check at least 3, not just the 1-2 checked in Task 4).
6. Confirm no regression: open Revenge's own Plugins list, confirm it still lists and manages every plugin normally; open one non-Rosie plugin's settings (e.g. anything from a different author in the installed list) and confirm it still works unaffected.
7. Visit `https://rp.jarviscli.dev/rose-plugs/` in a browser and confirm the Nexus site renders RosePlugs' own page correctly with the Task 8 Step 1 metadata.
