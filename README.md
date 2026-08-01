# revenge-plugins

A small collection of plugins for [Revenge](https://github.com/revenge-mod/revenge-bundle), the Discord Android client mod.

## Installing a plugin

1. Open Discord with Revenge installed, go to **Settings → Plugins**.
2. Tap the `+` button and paste the plugin's install link (see below).
3. Enable it.

| Plugin | Description | Install link |
| --- | --- | --- |
| Staff Tags | Adds OWNER/ADMIN/STAFF/MOD-style tags next to members, based on their actual server permissions. Fully customizable: per-tag text, colors, gradients, and visibility. | `https://everestmcarthur.github.io/revenge-plugins/staff-tags/` |

## About Staff Tags

This is a rebuilt version of the old `staff-tags` plugin, which stopped working after Discord renamed some of the
internal components it depended on (`DisplayName`, `HeaderName`, `getTagProperties`) - when any one of those lookups
came back empty, the entire plugin used to fail to load, taking every tag down with it, everywhere.

This version isolates each patch (chat tags, member list, profile, channel header) so that if Discord changes one of
them again in the future, only that specific surface stops showing tags instead of the whole plugin breaking. It also
adds:

- Per-tag show/hide toggles
- Custom tag text
- Custom solid colors
- Gradient tags (member list & profile only - chat message tags are rendered from data rather than a
  patchable element, so they always use a solid color)
- "Use top role color" as a fallback when no custom color is set

Tags are computed from the built-in `computePermissions` API against real permission bits (Administrator, Manage
Server, Manage Messages, Kick/Ban, etc.), the same as the original plugin, not from role names.

## Building locally

```sh
npm install
npm run build
```

Output is written to `dist/<plugin>/`.

## Contributing

Issues and PRs are welcome, especially if a Discord update breaks a lookup a plugin relies on - `findByName` /
`findByProps` targets can and do change without notice.
