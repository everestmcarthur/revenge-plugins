# revenge-plugins

A collection of plugins for [Revenge](https://github.com/revenge-mod/revenge-bundle), the Discord Android client mod.

**Browse them at [rp.jarviscli.dev](https://rp.jarviscli.dev)** - searchable, with a full detail page per plugin.

## Installing a plugin

Each plugin has two URLs:

- `rp.jarviscli.dev/<plugin>/` - a real page describing the plugin (features, commands, how it works)
- `rp.jarviscli.dev/<plugin>/install/` - the actual install link you paste into Revenge

To install: open Discord with Revenge installed, go to **Settings → Plugins**, tap `+`, and paste the
`/install/` link.

## Plugins

### Moderation & appearance

| Plugin | Status | Description | Install link |
| --- | --- | --- | --- |
| Staff Tags | Rebuilt | OWNER/ADMIN/STAFF/MOD-style tags next to members, computed from real server permissions. Per-tag text, colors, gradients, and visibility. | `https://rp.jarviscli.dev/staff-tags/install/` |
| RoleColorEverywhere | Revived | A member's top role color shown in mentions, the typing indicator, voice channel names, member list role headers, and optionally message text. | `https://rp.jarviscli.dev/role-color-everywhere/install/` |
| PronounDB | Revived | Shows a user's pronouns in their profile, if they've set them at pronoundb.org (nothing to configure in the plugin itself). | `https://rp.jarviscli.dev/pronoun-db/install/` |

### Productivity

| Plugin | Status | Description | Install link |
| --- | --- | --- | --- |
| Message Snippets | New | Save reusable text and send it with `/snippet <name>`. Manage snippets in-app or with `/snippet-save`, `/snippet-delete`, `/snippet-list`. | `https://rp.jarviscli.dev/message-snippets/install/` |
| Reminders | New | `/remind 20m Walk the dog` - fires while Discord is running. Can't wake the app from fully closed (no native notification access from a JS plugin). | `https://rp.jarviscli.dev/reminders/install/` |

"Revived" means the plugin previously existed elsewhere, stopped working after a Discord/API update, and has been rebuilt here.
"Rebuilt" means it's a from-scratch reimplementation of a previously-broken plugin with expanded features. "New" means
it didn't exist anywhere in the Revenge/Vendetta plugin ecosystem before.

## Why some of these broke before, and what's different now

Both Staff Tags and RoleColorEverywhere previously failed completely (not just partially) when a single internal
Discord component got renamed - one bad lookup threw during setup, which crashed the plugin's `onLoad` before it
could apply any of its other patches. Every rebuilt/revived plugin in this repo isolates each patch surface behind
its own guard, so if Discord changes one internal again, only that specific surface goes quiet instead of taking
the whole plugin down. PronounDB's break was simpler: its old data source was a PronounDB API version that Discord
had nothing to do with - PronounDB itself shut it down (HTTP 410) - so it's been migrated to their current v2 API.

## Shared plugin library

`shared/` holds code every plugin can use - `@shared/lib/patcher` (the crash-isolation helper described
above), `@shared/lib/color`, and reusable settings UI (`SettingsScaffold`, `NoteBox`, `ColorInput`,
`ListSection`, `PrimaryButton`). Plugins are still installed and run independently by users, so this isn't
a runtime dependency - Rollup inlines whatever a plugin imports from `@shared/*` straight into that
plugin's own bundle at build time. Import it like any other module:

```ts
import { applyPatches } from "@shared/lib/patcher";
import ColorInput from "@shared/ui/ColorInput";
```

## Building locally

```sh
npm install
npm run build
```

This runs both `build.mjs` (compiles every plugin in `plugins/*` into `dist/<id>/install/`) and
`scripts/generate-site.mjs` (builds `dist/plugins-data.json` from those manifests + `site/meta.json`,
and writes the website - a homepage at `dist/index.html` and a real page per plugin at `dist/<id>/index.html`).

## Releasing an update

1. Edit a plugin under `plugins/<id>/src/`.
2. `npm run build` locally and sanity-check the output in `dist/`.
3. `git add -A && git commit -m "..." && git push origin main`.
4. GitHub Actions rebuilds and redeploys to `rp.jarviscli.dev` automatically (usually under a minute) -
   check progress at the repo's **Actions** tab.

There's no manual deploy step - anything merged to `main` goes live.

## Contributing

Issues and PRs are welcome, especially if a Discord update breaks a lookup a plugin relies on - `findByName` /
`findByProps` targets can and do change without notice.
