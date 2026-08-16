# Split Messages - Design Spec

## Goal

When a composed message exceeds Discord's character limit (2000, or 4000 with Nitro), automatically split it into multiple sequential messages instead of showing Discord's native "message too long" popup and blocking the send.

Built for classic (Vendetta-compat, `/root/revenge-plugins`) first, to validate the concept before porting to Next.

## Reference

Ported from `sunnniee/vendetta-plugins`'s `SplitLargeMessages` (https://github.com/sunnniee/vendetta-plugins/tree/master/plugins/SplitLargeMessages), live-verified against a connected classic client on this session's Discord build:
- `findByProps("MAX_MESSAGE_LENGTH")` exists, with `MAX_MESSAGE_LENGTH: 2000` and `MAX_MESSAGE_LENGTH_PREMIUM: 4000`.
- `findByProps("sendMessage", "editMessage")._sendMessage` exists as a callable function.
- `UserStore.getCurrentUser().premiumType` reflects Nitro status (2 = full Nitro).

## Architecture

On `onLoad`:
1. Locate `Constants = findByProps("MAX_MESSAGE_LENGTH")` and raise `MAX_MESSAGE_LENGTH`/`MAX_MESSAGE_LENGTH_PREMIUM` to a very large number (`2 ** 30`). This is what stops Discord's own composer from ever showing the native "too long" popup or blocking the send button - the check that shows that popup reads these constants directly, not any `MessageActions` function (confirmed live: neither `sendMessage` nor `validateMessage` were called at all when a real over-limit send was attempted before this fix).
2. Patch `before` on `MessageActions.sendMessage`. Inside the hook:
   - Read the real limit for this send: `UserStore.getCurrentUser()?.premiumType === 2 ? 4000 : 2000`.
   - If `content.length` is under that limit, return immediately (no-op, real send proceeds normally).
   - Otherwise, run the splitting algorithm (below) to get an ordered list of chunks.
     - If splitting fails (an unsplittable token longer than the limit), clear `args[1].content` to `""`, show an error toast, and return - nothing sends.
     - Otherwise, mutate `args[1].content` to the FIRST chunk only, so the original `sendMessage` call proceeds as a normal send for chunk 1.
     - Fire an async loop (not awaited by the hook itself) that sends the remaining chunks in order via `MessageActions._sendMessage(channelId, { ...same invalidEmojis/validNonShortcutEmojis/tts, content: chunk }, {})`, sleeping `Math.max(channel.rateLimitPerUser, 1000)` ms (channel slowmode, 1s floor) between each.

On `onUnload`: restore `Constants.MAX_MESSAGE_LENGTH = 2000` and `MAX_MESSAGE_LENGTH_PREMIUM = 4000`, and unpatch the hook, so nothing is left in a broken state if disabled.

## Splitting algorithm

Input: `content: string`, `maxLength: number`. Output: `string[] | false` (false = unsplittable).

1. **Segment** the content into an ordered list of pieces by extracting fenced code blocks (` ```...``` `, including the fence lines and any language tag) as atomic units, with everything between/around them as plain-text pieces. A code block piece is never split internally unless it alone exceeds `maxLength` (see step 3).
2. **Plain-text pieces**: split by paragraph first (newline-separated), greedily packing paragraphs into sub-chunks up to `maxLength` characters (matching the reference's reduce-based packing). If any resulting sub-chunk is still over `maxLength` (a single paragraph longer than the limit with no newlines to split on), fall back to packing whole words (space-separated) instead, for that piece.
3. **Code-block pieces**: if the whole block (fences included) fits within `maxLength`, keep it as one atomic piece. If it doesn't fit even alone, split its inner lines into groups that fit (accounting for the extra ` ``` ` fence overhead added to each group), and re-wrap each group with its own opening/closing fence so every resulting message still renders as a code block.
4. **Pack**: greedily accumulate the ordered pieces (text sub-chunks and code-block pieces) into final chunks up to `maxLength`, same greedy strategy as the reference - never split a code-block piece across this final packing step.
5. **Failure**: if any single atomic piece from steps 2-3 is still longer than `maxLength` on its own (e.g. one word/URL/token with no break points), splitting fails - return `false`.

Setting: `storage.splitOnWords` (boolean, default `false`) - when true, skip the paragraph-first pass for plain text and go straight to word-based splitting, matching the reference's existing toggle.

## Explicitly out of scope

- Editing an existing message into an over-limit state (matches the reference - only sending is handled).
- Any "split into N messages" notification - silent by design, per user's call.
- The Next port - this spec covers classic only; Next's plugin architecture differs enough (different module system, different `MessageActions` equivalent) that it needs its own investigation once this is validated.

## Testing

No automated test suite exists for this repo's plugins (matches the rest of the codebase - verification is live, against a connected devtools client). Verification plan:
- Live-verify the raised constants actually suppress the native popup for an over-2000/over-4000 character message.
- Live-verify a plain-text-only over-limit message splits and sends correctly, with all chunks arriving in order.
- Live-verify a message containing a code block that would otherwise straddle a split point instead keeps the code block intact in one message.
- Live-verify the unsplittable-token failure case (a single 5000-character no-space token) shows the error toast and sends nothing.
- Live-verify `onUnload` restores native behavior (native popup returns for an over-limit message after disabling the plugin).
