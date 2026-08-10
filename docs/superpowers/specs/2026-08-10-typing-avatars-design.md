# Typing Avatars — Design

## Origin

Inspired by the (now-defunct) community plugin at https://fierdetta.github.io/typing-avatars/,
which replaced Discord's typing indicator with the avatars of whoever's typing. Reviving the
concept as a new plugin in this repo, built on top of the `TypingIndicatorInner` interception
work already done and verified in `role-color-everywhere/src/patches/typingWrapper.ts`.

## Scope

New standalone plugin, `typing-avatars` — not folded into RoleColorEverywhere, so it can be
enabled independently.

## Mechanism

Reuses the proven-safe pattern from `typingWrapper.ts`:

1. `registerTypeDetector` (from `@shared/lib/createElementIntercept`) catches
   `TypingIndicatorInner` by name.
2. The captured inner render function is wrapped so it's still called exactly once per render,
   from within the wrapper - this is what preserves its internal hooks and avoids the
   "Rendered more/fewer hooks than during the previous render" crash class encountered earlier
   this session when a component was called out-of-band as a side effect.
3. `findInReactTree` locates the label node that previously held the "X is typing..." text and
   per-user colored `<Text>` children (typingWrapper.ts already established this lookup works).
4. Instead of recoloring that text (RoleColorEverywhere's approach), this plugin replaces the
   label node's rendered content entirely with a new `AvatarStack` component, built from
   `props.typingUserIds`.

## AvatarStack component

- **Input:** `typingUserIds: string[]`, `guildId: string`.
- **Avatar source:** per-server avatar first (via `GuildMemberStore`, matching what's shown
  elsewhere in that server's member list/messages), falling back to the user's global Discord
  avatar (via `UserStore`) if they have no server-specific avatar set.
- **URL construction:** via Discord's own avatar-URL utility module (handles animated/gif
  avatars and the default-avatar fallback correctly) rather than hand-rolled CDN URL strings.
  The exact module/function name is **not yet verified live** - `revenge-devtools` was
  disconnected during this design session. This must be confirmed via live devtools before
  shipping, not guessed.
- **Layout:** overlapping circular avatars (each avatar slightly overlapping the previous, like
  Discord's own "who's here" clusters elsewhere in the app).
- **No text label** - avatars only, matching the original plugin's description most literally.
- **No tap interaction** - purely decorative for v1. A per-avatar "tap to view profile" handler
  is a plausible future addition, out of scope here.
- **Overflow:** no cap on typer count - if the row would overflow the available width, it wraps
  to a second overlapping row rather than clipping or truncating with a "+N" badge.

## Error handling

Matches this repo's established convention:

- Every patch point wrapped in try/catch; a thrown error leaves the indicator without the
  avatar-row patch rather than crashing the surrounding render.
- If avatar resolution fails for a specific user (missing member/user store data), that one
  avatar falls back to Discord's default avatar image rather than breaking the whole row.
- If `TypingIndicatorInner` can't be found at all (Discord build changed, module not yet
  registered), the plugin logs a warning via the shared `applyPatches` logger and no-ops,
  consistent with every other plugin in this repo.

## Testing plan

- Local build/bundle check via `node build.mjs` (repo's existing build script) before every
  deploy, same as done for the CopyRoleColor gradient fix.
- Live verification via `revenge-devtools` (eval + react tree tools) once reconnected:
  confirm the avatar-URL module API, confirm `TypingIndicatorInner`'s label-replacement still
  renders correctly with real typing users, confirm per-server avatar fallback behaves as
  expected for a user with no server-specific avatar.
- No claim of "working" until live-verified on a real device, per this session's established
  standard (no best-effort claims).
