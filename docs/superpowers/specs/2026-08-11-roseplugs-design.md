# RosePlugs — design spec

## Purpose

A new Revenge/Vendetta plugin that gives Rosie's own plugins a home of their own in
Discord's Settings, instead of leaving them buried inside Revenge's generic Plugins
list. Adds a new top-level settings section titled **"Rosie's Plugs"**, whose first
row is a quick-install browser for Rosie's plugins, followed by a direct settings
shortcut for each of Rosie's plugins that's currently installed.

Explicitly separate from the existing private "RP Admin" plugin. RP Admin will
eventually be migrated to live inside this section too, but that's a future,
separate task — not part of this build.

## Non-goals

- Does not touch, hide, or replace Revenge's own "Plugins" management screen
  (enable/disable/uninstall stays there).
- Does not manage plugins by other authors — only plugins whose manifest lists
  "Rosie" as an author.
- No in-browser uninstall for v1 — that stays a one-tap trip to Revenge's own
  Plugins screen.

## Architecture

RosePlugs is fully self-contained. No changes to any of the other ~20 plugins in
this repo. Two independent patch mechanisms, both variations on the
`SETTING_RENDERER_CONFIG` / `createList` pattern already live-verified and shipping
in Raiden's Themes (`plugins/raidens-themes/src/patches/settings.ts`):

1. **New top-level section.** Raiden's Themes appends a row into the *existing*
   "Revenge" section's `settings` array. RosePlugs instead inserts a whole new
   section object — `{ label: "ROSES_PLUGS", title: "Rosie's Plugs", settings: [...] }`
   — into `config.sections` itself, as a sibling of the "Revenge" section rather than
   a row inside it. Same array, same object shape; confirmed directly against the
   Revenge client source at `/root/repos/revenge-bundle` (`core/ui/settings/pages/...`),
   not inferred from behavior alone. Patches both surfaces Raiden's Themes patches
   (the mobile list via `createList`, and the tablet/desktop panel via
   `renderTitle`/`sections`, with the same defensive try/catch since that second
   surface may not exist on a given build).

2. **Auto-discovering Rosie's other installed plugins.** At render time, reads
   `@vendetta/plugins`' `plugins` record (every installed plugin, keyed by id),
   filters to entries whose `manifest.authors` includes "Rosie", excludes RosePlugs
   itself, and adds one settings row per remaining plugin that actually exports
   settings. Opening that row calls the plugin's own `getSettings(id)` — the same
   generic Vendetta API Revenge's own plugin browser uses. Nothing to maintain here
   when a new plugin ships under Rosie's name; it appears automatically next time
   Settings is opened.

Rejected alternative: having each of the 20 plugins explicitly register itself with
RosePlugs (a shared call added to each plugin's `index.ts`). Rejected because
`manifest.authors` + `getSettings` already provides everything needed generically,
and touching 20 already-shipping files for no functional gain is unnecessary risk.

## Components

- `src/index.ts` — plugin entry, wires the two patches on load, cleans up on unload.
- `src/patches/settings.ts` — the section-insertion + row-injection patch, adapted
  from Raiden's Themes' `patches/settings.ts` (new-section insertion instead of
  row-append; adds the discovery loop over `@vendetta/plugins`).
- `src/patches/discoverPlugins.ts` — builds the list of Rosie-authored installed
  plugins (id, manifest, `getSettings` result) from the `@vendetta/plugins` API.
- `src/ui/PluginsBrowser.tsx` — the "Plugins" screen: fetches, caches, and renders
  the categorized quick-install list.
- `src/ui/PluginDetailSheet.tsx` — the per-plugin detail/install action sheet shown
  on row tap.
- `src/lib/nexusApi.ts` — fetch + in-memory cache of
  `https://rp.jarviscli.dev/plugins-data.json`.
- `src/ui/Settings.tsx` — RosePlugs' own minimal settings screen (short description
  + a "refresh plugin list" button that busts the cache in `nexusApi.ts`).

## Data flow

1. Settings screen opens → RosePlugs' `createList`/panel patch runs → inserts the
   "Rosie's Plugs" section with a "Plugins" row plus one row per installed
   Rosie-authored plugin with settings.
2. Tapping "Plugins" navigates to `PluginsBrowser`, which calls `nexusApi.ts` (cached
   after first fetch this session) and renders plugins grouped by `category`, each
   row showing name, tagline, and a status badge when status isn't the default.
3. Tapping a plugin row opens `PluginDetailSheet` with the full tagline/status note
   and an Install button (or an "Installed" indicator if already present in
   `@vendetta/plugins`' `plugins` record).
4. Install calls `installPlugin(installUrl)` from `@vendetta/plugins` directly — no
   deep link needed, confirmed against the Revenge client source. The row reflects
   loading → installed/error state.
5. Tapping one of the per-plugin settings rows back in the main section calls that
   plugin's `getSettings(id)` and navigates to the result, same as Revenge's own
   plugin browser does internally.

## Error handling

- `nexusApi.ts` fetch failure: `PluginsBrowser` shows an inline error state with a
  retry button. Scoped to that one screen — it can't affect the main Settings list,
  since it only runs after navigating into "Plugins."
- Missing/unavailable `SETTING_RENDERER_CONFIG` or `createList` module: patch
  function logs a warning and returns without throwing, matching Raiden's Themes'
  existing defensive style.
- A Rosie-authored plugin with a broken `getSettings` (throws on render): not
  specially guarded beyond React's own error boundary at the settings-screen level —
  consistent with how Revenge's own plugin browser handles the same case today.

## Testing / live verification

Standard for this repo: build, deploy, purge cache, then live-verify via
revenge-devtools before considering any part done:

- "Rosie's Plugs" section appears in Settings, in the right position, with the
  right title.
- "Plugins" row opens the browser; data is real and categorized correctly; status
  badges match the live JSON.
- Installing a not-yet-installed plugin actually installs it and the row updates.
- An already-installed Rosie-authored plugin shows a settings row that opens the
  correct screen.
- No regression to Revenge's own Plugins screen or to any other installed plugin's
  settings.

## Manifest

- id: `rose-plugs`
- name: `RosePlugs`
- author: `Rosie`
- section label/title: `Rosie's Plugs`
