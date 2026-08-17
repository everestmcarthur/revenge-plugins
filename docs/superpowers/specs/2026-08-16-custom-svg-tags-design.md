# Custom SVG tags + icon-only mode (staff-tags, custom-user-tags)

Date: 2026-08-16
Repos/plugins: `staff-tags`, `custom-user-tags` (classic, `/root/revenge-plugins`)

## Problem

Both plugins currently support only a fixed set of ~50 preset monochrome icons (`lib/icons.ts`,
rendered as a single SVG `path` via `ui/Icon.tsx`). Users want to supply their own SVG artwork for
a tag's icon, and want an easy way to show only the icon with no text label at all — today a tag
always falls back to `defaultText`/its stored text and never renders truly empty.

## Feasibility (confirmed live against a connected 340.13 client)

`findByProps("Svg")` — the module both plugins already use for `Svg`/`Path` — also exports
`SvgXml`/`SvgFromXml`/`SvgUri`/`SvgCss` and the full `react-native-svg` primitive set (`Circle`,
`Rect`, `G`, gradients, etc.). Discord bundles the complete library, not just the two primitives
currently used. Rendering arbitrary user-supplied SVG markup via `SvgXml` requires no new
dependency.

## Decisions (from user)

- **Input method:** paste raw SVG markup into a text field. No native file/document picker — avoids
  depending on an RN module that isn't confirmed available in Revenge's plugin sandbox.
- **Coloring:** a custom SVG keeps its own authored colors. The tag's color/gradient settings only
  affect the text label and background chip, not the SVG's internal fills. (Preset icons keep their
  existing behavior: force-tinted to the tag's icon color.)
- **Icon-only toggle:** one general "Icon only (hide text)" switch that works for both preset icons
  and custom SVGs, not a custom-SVG-specific feature.

## Data model changes

`staff-tags/src/lib/getTag.ts` — `TagOverride` interface gains:
```ts
customSvg?: string;           // raw SVG markup, mutually exclusive with `icon` (preset id)
customSvgFallback?: string;   // short text shown in chat, where icons can't render at all
iconOnly?: boolean;
```
`custom-user-tags/src/lib/tags.ts` — `UserTag` interface gains the same three fields.

Setting `customSvg` in the editor UI clears `icon` (and vice versa) — a tag has at most one icon
source at a time. Nothing in storage besides these two fields changes.

## Icon representation and rendering

Extend `IconDef` (`lib/icons.ts`, both plugins) to represent either a preset or a custom SVG:
```ts
export interface IconDef {
    id: string;
    name: string;
    fallback: string;
    path?: string;      // preset: path data
    viewBox?: string;    // preset: defaults to "0 0 24 24"
    svg?: string;        // custom: full raw markup
}
```
`getIcon(id)` is unchanged (still resolves preset ids from `ICONS`). A new path in
`getTag.ts`/`resolveTag.ts`: if `settings.customSvg`/`tag.customSvg` is set, build the resolved
tag's `icon` as `{ id: "custom", name: "Custom", fallback: settings.customSvgFallback ?? "",
svg: settings.customSvg }` instead of calling `getIcon(settings.icon)`.

`ui/Icon.tsx` branches on which field is present:
- `icon.svg` set → `<SvgXml xml={icon.svg} width={size} height={size} style={style} />`, no `fill`
  prop (preserves the SVG's own colors). Wrapped in try/catch — a malformed paste renders nothing
  instead of throwing, consistent with how the rest of these patches degrade on bad input.
- `icon.path` set → existing `<Svg><Path d={icon.path} /></Svg>` behavior, unchanged, still tinted
  via the `color` prop.

Every existing call site (`patches/tag.tsx`'s chat-tag styling, `ui/GradientTag.tsx`) already just
passes `icon` and `color` through to `Icon` generically — no changes needed there.

## Icon-only text suppression

`getTag.ts` currently resolves text as `settings.text?.trim() || def.defaultText` — never actually
empty. When `settings.iconOnly`/`tag.iconOnly` is true, resolve `text: ""` instead, skipping the
`defaultText` fallback. This requires an icon (preset or custom) to be set — the editor UI disables
the toggle when no icon is selected, since an empty-text/no-icon tag would render nothing.

This already flows correctly with no further changes:
- Name row / member list / profile (JSX surfaces): render the icon with an empty label.
- Chat (`patches/chat.ts`, flat-data surface, can never render a real icon — pre-existing platform
  limit both plugins already document): existing ternary
  `tag.icon ? (tag.text ? icon+text : icon.fallback) : tag.text` already falls through to
  `icon.fallback` when text is empty. Preset icons already have a `fallback` glyph. Custom SVGs
  don't, so the editor gets an optional short "fallback text for chat" input next to the paste box
  (stored as `customSvgFallback?: string`) — if left blank, chat shows an empty-but-colored chip.
  Acceptable degraded case; not worth blocking on.

## Input validation

On save, before writing `customSvg` to storage: trim whitespace, reject (inline error, don't save)
if empty or doesn't start with `<svg` (case-insensitive), cap at 20,000 characters. No deeper XML
parsing/validation at save time — the render-time try/catch around `SvgXml` is the actual safety
net against malformed-but-passes-the-basic-check markup.

## UI changes

`staff-tags/src/ui/pages/Settings.tsx` and `custom-user-tags/src/ui/TagEditorAlert.tsx` (each
plugin's real per-tag editor — confirmed these are where `IconPicker`/`ColorInput` are currently
wired in, not any shared file):
- A multiline text input for pasting SVG markup, next to the existing `IconPicker`. Selecting a
  preset icon clears `customSvg`; entering SVG markup clears `icon`.
- A short "fallback text for chat" input, shown only when `customSvg` is set.
- An "Icon only (hide text)" switch, disabled unless an icon (preset or custom) is currently set.

## Files touched (9 files: 4 in staff-tags, 5 in custom-user-tags — custom-user-tags splits
resolution across two files where staff-tags has one)

- `lib/icons.ts` — `IconDef` shape
- `lib/getTag.ts` (staff-tags) / `lib/resolveTag.ts` + `lib/tags.ts` (custom-user-tags) — storage
  fields, resolution logic
- `ui/Icon.tsx` — `SvgXml` render branch
- `ui/pages/Settings.tsx` (staff-tags) / `ui/TagEditorAlert.tsx` (custom-user-tags) — paste field,
  fallback-text field, icon-only switch

## Explicitly out of scope

- File/document picker upload.
- Recoloring or otherwise transforming a custom SVG's internal fills.
- Any change to `patches/name.tsx`, `patches/details.tsx`, `patches/profile.tsx`, or
  `patches/tag.tsx` — they already consume `icon`/`text` generically and need no changes.
