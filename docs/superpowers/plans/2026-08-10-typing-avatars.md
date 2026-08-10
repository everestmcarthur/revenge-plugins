# Typing Avatars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new standalone Vendetta plugin, `TypingAvatars`, that replaces Discord's "X is typing..." indicator with a row of the avatars of whoever's currently typing.

**Architecture:** Reuses the proven-safe `TypingIndicatorInner` interception already verified in `role-color-everywhere/src/patches/typingWrapper.ts` (this repo, same session): catch the component via `registerTypeDetector`, wrap it so the original still renders exactly once (preserving its hooks), find the label node that used to hold the typing text, and replace its children with a new `AvatarStack` component built from `props.typingUserIds`.

**Tech Stack:** TypeScript, React (via `@vendetta/metro/common`), React Native (`View`/`Image`), this repo's shared `@shared/lib/createElementIntercept` and `@shared/lib/patcher` helpers, Rollup/SWC build (`node build.mjs`).

## Global Constraints

- No test runner exists in this repo (`package.json` has only a `build` script) — every plugin here is verified by `node build.mjs` (bundling/syntax correctness) plus live on-device verification via `revenge-devtools`, not unit tests. This plan follows that same convention.
- Every patch point must be wrapped in try/catch that leaves the original behavior intact on failure, matching every other plugin in this repo (see `role-color-everywhere`, `copy-role-color`, `server-drawer`).
- `channel.guild_id` (snake_case) is the confirmed field for a channel's guild id — verified in `typingWrapper.ts:46` and `rows.ts:39`. Do not use `channel.guildId`.
- `GuildMemberStore.getMember(guildId, userId)` and `UserStore` (via `findByStoreName`) are confirmed-working store lookups elsewhere in this repo — but the exact avatar-hash property name on the returned member/user record (`member.avatar` / `user.avatar`) has **not** been live-verified. Flag this clearly in code comments; confirm in Task 4.
- CDN avatar URLs are hand-built directly (`https://cdn.discordapp.com/...`), matching this repo's own established pattern in `server-drawer/src/components/GuildIcon.tsx:26` — not a guessed Discord internal "IconUtils" module lookup.
- `revenge-devtools` was disconnected while this plan was written. Task 4 (live verification) cannot run until it reconnects — do not claim the plugin "works" before that task is actually completed against a live device.

---

### Task 1: Scaffold the plugin

**Files:**
- Create: `plugins/typing-avatars/manifest.json`
- Create: `plugins/typing-avatars/src/index.ts`

**Interfaces:**
- Produces: a default-exported plugin object (`{ onLoad, onUnload }`) that later tasks wire their patch functions into.

- [ ] **Step 1: Create the manifest**

```json
{
    "name": "TypingAvatars",
    "description": "Replaces the \"X is typing...\" indicator with the avatars of whoever's typing.",
    "authors": [
        { "name": "Rosie" }
    ],
    "main": "src/index.ts",
    "vendetta": {
        "icon": "ic_group"
    }
}
```

`ic_group` is a confirmed-existing bundled icon name — already used by another plugin in this repo (`grep -h '"icon"' plugins/*/manifest.json`).

- [ ] **Step 2: Create the plugin entry point with no patches wired yet**

```ts
import { logger } from "@vendetta";
import { applyPatches } from "@shared/lib/patcher";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("TypingAvatars", logger, {});
    },
    onUnload: () => unpatchAll()
};
```

- [ ] **Step 3: Build and verify**

Run: `cd /root/revenge-plugins && node build.mjs`
Expected: output includes `Successfully built TypingAvatars!` with no errors.

- [ ] **Step 4: Commit**

```bash
git add plugins/typing-avatars/manifest.json plugins/typing-avatars/src/index.ts
git commit -m "typing-avatars: scaffold new plugin"
```

---

### Task 2: Avatar URL resolution

**Files:**
- Create: `plugins/typing-avatars/src/lib/avatarUrl.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `getTypingAvatarURL(guildId: string | undefined, userId: string, size?: number): string | null`, used by Task 3's `AvatarStack` component.

- [ ] **Step 1: Write the resolution helper**

```ts
import { findByStoreName } from "@vendetta/metro";

const UserStore = findByStoreName("UserStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");

function avatarExtension(hash: string): string {
    return hash.startsWith("a_") ? "gif" : "png";
}

// member.avatar / user.avatar are the property names Discord's client uses for a per-server /
// global avatar hash respectively - GuildMemberStore.getMember and UserStore.getUser are both
// confirmed-working lookups elsewhere in this repo (typingWrapper.ts, getTag.ts), but the avatar
// hash field itself hasn't been live-verified yet. If avatars come back broken, check these two
// property reads first via devtools eval against a real member/user record.
export function getTypingAvatarURL(guildId: string | undefined, userId: string, size = 32): string | null {
    if (!userId) return null;

    const member = guildId ? GuildMemberStore?.getMember?.(guildId, userId) : null;
    const guildAvatarHash = member?.avatar;
    if (guildId && guildAvatarHash) {
        return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${guildAvatarHash}.${avatarExtension(guildAvatarHash)}?size=${size * 2}`;
    }

    const user = UserStore?.getUser?.(userId);
    const globalAvatarHash = user?.avatar;
    if (globalAvatarHash) {
        return `https://cdn.discordapp.com/avatars/${userId}/${globalAvatarHash}.${avatarExtension(globalAvatarHash)}?size=${size * 2}`;
    }

    // Discord's default avatar for users on the modern username system (no discriminator):
    // index = (snowflake >> 22) % 6. BigInt is required - the shift loses precision as a Number.
    const defaultIndex = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}
```

- [ ] **Step 2: Build and verify**

Run: `cd /root/revenge-plugins && node build.mjs`
Expected: `Successfully built TypingAvatars!`, no type/syntax errors.

- [ ] **Step 3: Commit**

```bash
git add plugins/typing-avatars/src/lib/avatarUrl.ts
git commit -m "typing-avatars: add avatar URL resolution helper"
```

---

### Task 3: AvatarStack component and the typing-indicator patch

**Files:**
- Create: `plugins/typing-avatars/src/components/AvatarStack.tsx`
- Create: `plugins/typing-avatars/src/patches/typingIndicator.tsx`
- Modify: `plugins/typing-avatars/src/index.ts`

**Interfaces:**
- Consumes: `getTypingAvatarURL` from Task 2 (`../lib/avatarUrl`).
- Produces: `AvatarStack` (default export, props `{ typingUserIds: string[]; guildId: string | undefined }`) and `patchTypingIndicator` (default export, `() => () => void`, same shape as every other patch function in this repo).

- [ ] **Step 1: Write the AvatarStack component**

```tsx
import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { getTypingAvatarURL } from "../lib/avatarUrl";

const SIZE = 20;
const OVERLAP = 8;

// No text label and no tap handler by design - purely decorative avatars replacing the
// "X is typing..." text entirely. If a lot of people are typing, this wraps to a second
// overlapping row rather than clipping or capping with a "+N" badge.
export default function AvatarStack({ typingUserIds, guildId }: { typingUserIds: string[]; guildId: string | undefined }) {
    if (!typingUserIds?.length) return null;

    return (
        <View style={st.row}>
            {typingUserIds.map((userId, i) => {
                const uri = getTypingAvatarURL(guildId, userId, SIZE);
                if (!uri) return null;
                return (
                    <Image
                        key={userId}
                        source={{ uri }}
                        style={[st.avatar, i > 0 ? st.overlap : null]}
                    />
                );
            })}
        </View>
    );
}

const st = StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
    avatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
    overlap: { marginLeft: -OVERLAP },
});
```

- [ ] **Step 2: Write the typing-indicator patch**

This mirrors `role-color-everywhere/src/patches/typingWrapper.ts` exactly for the detection/wrapping part (already proven live in this repo), but replaces the label's content with `AvatarStack` instead of recoloring the existing per-user text nodes. Unlike the color-matching version, this doesn't need to zip `typingUserIds` against per-user text elements at all - it only needs `props.typingUserIds` directly, so it isn't affected by the "several people are typing..." collapsed-string case that made the color patch bail out.

```tsx
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import AvatarStack from "../components/AvatarStack";

export default function patchTypingIndicator(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "typing-avatars-indicator",
        (type) => typeof type === "function" ? type.name === "TypingIndicatorInner" : type?.type?.name === "TypingIndicatorInner",
        (TypingIndicatorInner: any) => {
            const inner = typeof TypingIndicatorInner === "function" ? TypingIndicatorInner : TypingIndicatorInner.type;

            const PatchedTypingIndicatorInner = (props: any) => {
                const ret = inner(props);

                try {
                    const label = findInReactTree(
                        ret,
                        (n: any) =>
                            Array.isArray(n?.props?.children) &&
                            n.props.children.some((c: any) => typeof c === "string" && c.includes("typing..."))
                    );
                    if (!label?.props) return ret;

                    const typingUserIds: string[] = props?.typingUserIds ?? [];
                    if (!typingUserIds.length) return ret;

                    label.props.children = (
                        <AvatarStack typingUserIds={typingUserIds} guildId={props?.channel?.guild_id} />
                    );
                } catch {
                    // Leave the default "X is typing..." text alone.
                }

                return ret;
            };

            registerIntercept(TypingIndicatorInner, PatchedTypingIndicatorInner);
        }
    );

    return () => cleanups.forEach((fn) => fn());
}
```

- [ ] **Step 3: Wire the patch into the plugin entry point**

Replace the contents of `plugins/typing-avatars/src/index.ts` with:

```ts
import { logger } from "@vendetta";
import { applyPatches } from "@shared/lib/patcher";
import patchTypingIndicator from "./patches/typingIndicator";

let unpatchAll: () => void = () => {};

export default {
    onLoad: () => {
        unpatchAll = applyPatches("TypingAvatars", logger, {
            "typing indicator avatars": patchTypingIndicator
        });
    },
    onUnload: () => unpatchAll()
};
```

- [ ] **Step 4: Build and verify**

Run: `cd /root/revenge-plugins && node build.mjs`
Expected: `Successfully built TypingAvatars!`, no type/syntax errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/typing-avatars/src/components/AvatarStack.tsx plugins/typing-avatars/src/patches/typingIndicator.tsx plugins/typing-avatars/src/index.ts
git commit -m "typing-avatars: add AvatarStack component and typing-indicator patch"
```

---

### Task 4: Deploy and live-verify

**Files:** none (verification only, using `revenge-devtools`)

**Interfaces:** none — this task confirms Tasks 1-3's assumptions against a real device and fixes anything wrong in place.

- [ ] **Step 1: Push to deploy**

```bash
cd /root/revenge-plugins && git push
```

Confirms the auto-deploy pipeline (GitHub Actions → `rp.jarviscli.dev`) picks up the new plugin. Wait for the user to enable it on their device.

- [ ] **Step 2: Confirm `TypingIndicatorInner` interception fires**

Via `revenge-devtools` `eval`, install a one-off probe patching `TypingIndicatorInner`'s call count (same technique used earlier this session for `useIsMobileQuestDockRendered`), then have the user start typing in a channel with someone else. Confirm the patch's `console.log`/counter actually fires - if it doesn't, the type-name check (`type.name === "TypingIndicatorInner"`) needs re-verification against the current Discord build, the same way this session discovered `QuestDockContentExpanded` had silently drifted.

- [ ] **Step 3: Confirm the avatar hash field names**

Via `eval`, call `GuildMemberStore.getMember(guildId, userId)` and `UserStore.getUser(userId)` for a real user who is currently typing, and inspect the returned object's keys directly (`Object.keys(member)`) rather than assuming `.avatar` is correct. Fix `avatarUrl.ts` if the real field name differs, per the Global Constraints note above.

- [ ] **Step 4: Confirm the rendered layout on-device**

Have the user get 1, 2, and 3+ people typing simultaneously in a test channel (or DM group) and screenshot each state. Confirm: avatars render (not broken images), the overlap direction looks right, and 3+ typers wrap to a second row rather than clipping off-screen.

- [ ] **Step 5: Fix and re-deploy anything found wrong in Steps 2-4, then commit**

```bash
git add -A
git commit -m "typing-avatars: fix issues found in live verification"
git push
```

Only after this task's steps have actually been run against a live device should the plugin be described as working - not before.
