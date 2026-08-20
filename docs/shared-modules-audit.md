# Shared modules audit (classic revenge-plugins)

Date: 2026-08-16
Scope: `/root/revenge-plugins` only (Next repo not covered). Audit only — no code changed.

Goal: (1) give a reference sheet of what `shared/` already offers so new/edited plugins reach for
it instead of reinventing, and (2) list concrete cases where 2+ plugins built the same thing
independently, so we know what's actually worth promoting to `shared/` next.

## 1. Reference: what's already in `shared/` and who uses it

| Module | What it does | Adoption |
|---|---|---|
| `ui/table.ts` | `TableRow`/`TableRowGroup`/`TableSwitchRow`/`TableRadioRow` — Discord's redesigned settings rows, falling back to legacy `Forms.Form*` | 24 files — well adopted, the default for any settings screen |
| `ui/SettingsScaffold.tsx` | ScrollView + bottom padding wrapper for a plugin's settings screen | 19 files — well adopted |
| `lib/color.ts` | `isValidHex`, `normalizeHex`, `resolveSemanticColor`/`resolveSemanticColorSafe` (theme-aware color token resolution) | 17 files — well adopted |
| `ui/NoteBox.tsx` | Bordered callout box for explanatory settings text | 15 files — well adopted |
| `ui/PrimaryButton.tsx` | Standard filled action button | 9 files — well adopted |
| `lib/rawFind.ts` | Walks `window.modules` directly for a module lookup that survives Revenge's negative-result caching | 8 files |
| `lib/patcher.ts` | `safePatch`/`applyPatches` — one broken patch surface can't crash a whole plugin's `onLoad` | 8 files — every plugin should use this for `onLoad`, worth spot-checking stragglers |
| `lib/createElementIntercept.ts` | Intercepts `React.createElement`/`jsx`/`jsxs` to replace or transform components that aren't exported and can't be `after()`-patched directly | 7 files |
| `lib/flux.ts` | `fluxSubscribe(event, cb, once?)` with built-in unsubscribe | 4 files |
| `lib/waitFor.ts` | Polls until a lazily-registered module/value appears, cancelable | 4 files |
| `ui/ListSection.tsx` | Titled section of tappable rows with an empty-state note | 3 files |
| `lib/lazy.ts` | Memoizing wrapper for a Metro lookup (resolve once, cache forever) | 2 files — low adoption, worth checking for plugins hand-rolling the same "cache after first resolve" pattern |
| `lib/patchRows.ts` | `patchRows(handler)` — hooks the native chat row bridge (`DCDChatManager.updateRows` / `RowManager.generate`) so a handler sees every message row as JSON | Used by rose-utils, role-color-everywhere, message-logger |
| `ui/ColorInput.tsx` | Hex color field with swatches | **1 file (radial-status)** — see finding #2, this is the stale version |

**Note on `patchRows.ts` vs the member-list "UserRow" pattern below:** these are unrelated despite
similar names. `patchRows` is for the *native chat message row bridge* (JSON crossing to native
code). The `findByTypeNameAll("UserRow")` pattern in finding #1 is a *React component* used in the
member list / profile popout. Don't conflate them when extracting shared code.

## 2. Findings: duplicated or fork-worthy code

### Finding 1 — `staff-tags` and `custom-user-tags` duplicate five files byte-for-byte
`ui/IconPicker.tsx`, `ui/Icon.tsx`, `lib/icons.ts`, and `patches/tag.tsx` are **100% identical**
between the two plugins (confirmed via `diff`, zero output). `ui/ColorInput.tsx` is also identical
between the two but has drifted from `shared/`'s version — see finding 2.

`patches/name.tsx`, `patches/details.tsx`, `patches/chat.ts`, `patches/profile.tsx` are not
byte-identical but are structurally the same patch applied twice: same target modules
(`DisplayName`, `UserRow`, `getTagProperties`, `UserProfilePrimaryInfo`), same comments explaining
*why* (e.g. "isn't a top-level export" copied verbatim into both `profile.tsx` files), and — not
in scope for this audit, but worth knowing — the **same latent bug** in both: the
`existingTag.props?.type !== 0` guard can't tell "a real Discord tag is here" from "the other
plugin already set a tag here," so having both plugins enabled causes one to silently clobber the
other's tag on a user. That's the parked staff-tags/custom-user-tags coexistence design (separate
task).

**Recommendation:** promote `IconPicker.tsx`, `Icon.tsx`, `icons.ts` to `shared/ui` and `shared/lib`
as-is (genuine, no-decision-needed duplication). Leave the four patch files alone for now — their
near-duplication is entangled with the coexistence bug fix, so refactor them together with that
work rather than as a mechanical move.

### Finding 2 — `shared/ui/ColorInput.tsx` is a stale stub; the real version lives unshared in two plugins
`shared/ui/ColorInput.tsx` is a minimal 2-swatch color field. `staff-tags/src/ui/ColorInput.tsx`
and `custom-user-tags/src/ui/ColorInput.tsx` (identical to each other) are a fuller implementation:
28 swatches, hex↔RGB conversion helpers, uses `normalizeHex` from `shared/lib/color`. Only
`radial-status` uses the shared stub today; everyone who needs a real color picker forked instead
of upstreaming.

**Recommendation:** replace `shared/ui/ColorInput.tsx`'s contents with the fuller version, point
`staff-tags`/`custom-user-tags`/`radial-status` at it, delete the two local copies. Check
`radial-status`'s usage still renders correctly with the richer swatch set before removing its
reliance on the stub.

### Finding 3 — `server-drawer` forked `createElementIntercept.ts` instead of extending the shared one
`server-drawer/src/patches/createElementIntercept.ts` is a deliberate fork of
`shared/lib/createElementIntercept.ts`, not accidental drift: it adds a `collapseAncestors` option
(ancestor-collapsing, used to hide the guilds bar and reclaim its layout space) that the shared
version doesn't have. 88 lines of diff, all additive on server-drawer's side.

**Recommendation:** this is a real capability gap in `shared/`, not a copy-paste duplication. Worth
upstreaming `collapseAncestors` into `shared/lib/createElementIntercept.ts` and switching
server-drawer back onto the shared module — but do it deliberately (it's shared infra used by 7
files across the repo; changing its behavior needs a look at every caller, not just server-drawer's
four files that reference it).

### Finding 4 — per-ID storage-map boilerplate repeated in at least 5 plugins
The pattern `storage.<key> ??= {}` followed by hand-written get/set/(sometimes remove) helpers for
a per-user or per-ID settings map shows up independently in:
- `staff-tags/src/lib/getTag.ts` (`tagSettings(id)`)
- `custom-user-tags/src/lib/tags.ts` (`allTags()`, `getUserTag()`, `setUserTag()`, `removeUserTag()`)
- `message-snippets/src/lib/snippets.ts`
- `radial-status/src/ui/Settings.tsx`
- `message-logger/src/index.ts` (single-key, simpler case)

**Recommendation:** a small `shared/lib/storageMap.ts` exporting something like
`createStorageMap<T>(storage, key)` → `{ get(id), set(id, value), remove(id), all() }` would
collapse ~15-20 lines per plugin into one call. Low risk, no behavior change, good first
extraction to pair with finding 1's icon files.

### Finding 5 — superseded, `raidens-themes` removed
Originally: `raidens-themes/src/patches/settings.ts` and `rose-plugs/src/patches/settings.ts`
independently solved "pin a settings entry into Discord's native App Settings" with different,
non-trivial APIs (272 lines of diff). `raidens-themes` was deleted from the repo on 2026-08-16, so
this is no longer a duplication to reconcile — `rose-plugs/src/patches/settings.ts` is now the only
implementation. Worth revisiting only if a future plugin wants the same capability; its
`SectionRow[]` API (`patches/settings.ts` exports `patchRosiesPlugsSection`) is the one to build on,
not extract into `shared/` preemptively with no second consumer.

## 3. Suggested order if/when this gets acted on
1. Finding 4 (storage map) — mechanical, zero behavior change, unblocks nothing else.
2. Finding 1's static files (icons/IconPicker) — mechanical, identical code, low risk.
3. Finding 2 (ColorInput) — mechanical but touches 3 plugins' rendering, needs a visual check.
4. Finding 3 (createElementIntercept collapseAncestors) — real shared-infra change, needs care.
5. Finding 1's patch files (name/details/chat/profile) — do together with the parked
   staff-tags/custom-user-tags coexistence design, not standalone.
6. Finding 5 (settings pinning) — defer until a third consumer exists.
