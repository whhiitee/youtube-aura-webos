# The Aura theme

One look. There is no theme selector because there is no second theme: the
settings panel, the toasts, the clock and the SponsorBlock list share one
palette, and the classes on `<html>` decide only how much of YouTube's own
chrome goes black.

## Palette

| Token | Value | Used for |
| --- | --- | --- |
| ink | `#000000` | the panel body, YouTube's surfaces under Pure Black UI, the OLED overlay |
| surface | `#0a0a0c` | the toasts, the clock |
| surface-2 | `#141418` | a raised row, a checked checkbox's resting fill |
| hairline | `#1f1f24` | separators, section borders, the panel's edge |
| text | `#f1f1f3` | labels and values |
| text-dim | `#8a8a96` | help lines, the version, inactive tabs |
| accent | `#8ab4f8` | focus, the active tab, the checked checkbox, the toast's edge |

Why these: on an OLED panel a pixel at `#000000` is **off**. Every surface the
app draws itself is true black, so the settings panel is a rectangle of light
type floating over the picture rather than a grey box. The accent is a single
ice blue — Google's own material light-blue — because it reads as "selected" on
both black and a bright thumbnail, and because one accent is one colour to
maintain.

Photographs and video are the only things allowed to be colourful. That is the
whole design rule.

## Type

`'LG Display', Roboto, 'Noto Sans', Arial, sans-serif` — the TV's own font
first, so the panel matches YouTube's UI beside it. Sizes are in `vh` so the
panel scales with the panel rather than with a fixed pixel grid; the body is
2.1 vh (about 22 px on a 1080p panel, roughly 18 pt at viewing distance).

- Panel heading: 2.9 vh, uppercase, 0.24 vh letter-spacing.
- Section titles: 1.6 vh, uppercase, 0.09 em tracking, `text-dim`.
- Rows: 2.1 vh; values 2.4 vh, weight 500.
- Help lines: 1.6 vh, `text-dim`.

## The mark

A white play triangle inside one ice-blue ring on true black, the triangle's
*centroid* at the ring's centre (a triangle centred on its bounding box reads as
too far left). Drawn by `tools/gen-icons.mjs` — pure Node, no image library — so
the artwork is code and can be reviewed in a diff:

```sh
node tools/gen-icons.mjs     # rewrites assets/*.png and src/ui/icons/aura-mark.png
```

Flat, deliberately: no glow, no gradient. It is what an OLED should show — one
line of light — and it compresses to 3.4 KiB where a soft halo made the same
icon 29 KiB.

## Focus

Focus is the only thing on screen competing with the video, so it is the
brightest element in the app:

| Where | State |
| --- | --- |
| A cycle row (`‹ value ›`) | `rgba(138,180,248,0.16)` fill, a 0.4 vh accent bar on the left |
| A checkbox row | same fill and bar, via `ytaf-focused` (Chromium 38 has no `:focus-within`) |
| The focused checkbox | accent border, 0.22 vh accent outline |
| A tab | inverted: accent fill, black text |
| A YouTube tile | accent ring, `0.375rem` |

No glow and no pulse anywhere: a moving focus ring is a repaint per frame on a
2017 SoC, and it fights the picture.

## Motion budget

Two animations exist, and both are handed to the compositor:

| What | How | Cost |
| --- | --- | --- |
| The panel's entrance | `opacity` + `translateY(0.8vh)`, 140 ms, once | one composited layer for 140 ms |
| A toast appearing or leaving | `opacity` + `translateX`, 140 ms | one composited layer per toast |

Everything else is instantaneous: the tab highlight, the focus fill, the clock
hiding, the OLED overlay. There are no CSS transitions on rows, no animated
shadows, no `filter: blur()`, and no gradient that a focus move re-evaluates.
`tests/smoke/bundle-check.cjs` fails the build if a `filter: blur()` or
`drop-shadow()` ever reaches the bundle.

## What is *not* done, on purpose

- **No backdrop blur.** `backdrop-filter` is not in Chromium 38, and a blur
  emulation is a repaint of the whole layer behind the panel.
- **No Liquid Glass by default.** The `New Liquid Glass UI` setting is kept
  from upstream (it restyles YouTube's own pills and chips); Aura's own UI does
  not use it, because the glass recipe is a gradient plus a shadow on every
  pill.
- **No custom properties.** Chromium 38 has no `var()`, so the palette is
  literals. `docs/THEME.md` (this file) is the single place the values are
  listed; the code repeats them.
- **No second theme.** Retired with the upstream `uiTheme` setting.

## Files

| File | Owns |
| --- | --- |
| `src/ui/panel/panel.css` | the panel shell, heading, tab bar, checkbox, focus highlight |
| `src/ui/panel/pages.css` | row metrics, sections, the two-column Main page, help text |
| `src/ui/panel/controls/controls.css` | the value side of a cycle row, the colour picker |
| `src/ui/toast/toast.css` | the toasts |
| `src/features/watch/watch.css` | the clock |
| `src/features/sponsorblock/popup.css` | the segment list beside the panel |
| `src/ui/styles/theme-aura.css` | the classes on `<html>`: Pure Black UI, the tile focus ring, card corners |
| `src/ui/styles/global.css` | the upstream UI tweaks (titles, search font, Liquid Glass, player shadows) |
| `src/ui/styles/yt-fixes.css` | upstream fixes for YouTube's own markup |

The split is by *who builds the element*, so a change to a row's look is in one
file and a change to YouTube's page is in another.

## Looking at it without a TV

`tools/preview-panel.mjs` builds the panel with the bundle itself (in jsdom, as
the behaviour tests do) and writes the page's real `<style>` plus the panel's
DOM into one standalone HTML file:

```sh
npm run build
YTAF_PREVIEW_OUT=docs/panel-preview.html node tools/preview-panel.mjs
```

Open that file in a browser at a 1080p window. Two layout bugs were found this
way and are now guarded by `tests/behaviour/panel-test.cjs`:

- **Tab widths.** `flex: 1 1 auto` sized the tabs to their labels, so "Main" was
  half the width of "SponsorBlock". They are `flex: none; width: 20%` now.
- **A clipped page.** Chromium 38 sizes the children of a flex column whose
  height is a *max-height* against the content height and then clips the
  overflow, so `flex: 1; min-height: 0` alone left the Main page's last rows
  outside the panel. The page carries `max-height: 76vh` (the panel's 90vh less
  its chrome) as well, and the Main page's rows are dense enough that all five
  pages fit without scrolling at 1080p.
