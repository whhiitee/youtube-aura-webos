# Performance

What was profiled, what it cost, what changed, and what it bought. Every number
below comes from `npm run bench` on this machine (a modern desktop, Node 26)
running the built bundle in jsdom with a Chromium 38 profile. That environment
reproduces the *engine's* constraints — missing APIs, ES5 syntax, no CSS custom
properties — but not the OLED55B7V's speed. Treat the ratios and the deltas as
trustworthy and the absolute milliseconds as an upper bound on a fast CPU.

The honest summary: **the visible win is the settings panel (65 ms → 11 ms on
the keypress) and 14 KiB less code. The hooks were already fast; measurement
showed the removal of the playback-speed step did not move the parse time.**

## How to reproduce

```sh
npm run build
npm run bench
```

`npm run bench` runs, in order:

| Script | Measures |
| --- | --- |
| `tests/bench/hook-bench.cjs` | `JSON.parse` / `JSON.stringify` hooks against the natives, **every filter on** (worst case) |
| `tests/bench/parse-breakdown.cjs` | the same parse with the filters turned on one at a time, so a change is judged by the row it moves |
| `tests/bench/panel-bench.cjs` | the wall time and element count of the settings panel's first open, cold and prewarmed |
| `tests/bench/boot-bench.cjs` | module evaluation at load, elements built, `<style>` elements |
| `tests/bench/emoji-bench.cjs` | the emoji fix scanning a 72-tile home screen, with and without emoji |
| `tests/bench/css-bench.cjs` | the joined stylesheet: bytes, selector count, attribute and universal selectors |

Baseline for comparison: the `0.8.5` legacy bundle, built from the parent
repository before any Aura change. The numbers are recorded in
`tests/bench/baseline-0.8.5.json`, together with the exact commit and how to
rebuild it; the 238 KiB bundle itself is not committed.

## 1. What runs on the hot path

YouTube's TV app parses thousands of JSON blobs. The hook has, in order:

1. `typeof text !== 'string' || text.length < 500` — a length read.
2. the native parse.
3. a three-property check that the result is an InnerTube response
   (`responseContext`, `playerResponse`, `continuationContents`).

Nothing allocates until step 3 passes. That was already true before Aura. What
Aura removed is the one call that ran for every object past the size gate:

```js
if (parsedObjectStep !== null) parsedObjectStep(data);   // removed
```

It existed only so the playback-speed feature could switch on YouTube's Speed
button. On this TV that feature cannot exist, so the branch, the variable and
the setter (`setParsedObjectStep`, its only export) are gone.

**Measured effect: none within noise.** That is the honest result — a null check
plus one call frame is below the measurement floor of a 0.36 ms parse.

| `parse` of a 150 KiB home response | upstream 0.8.5 | Aura |
| --- | --- | --- |
| hooked call (ms) | 0.368 | 0.362–0.371 |
| native call (ms) | 0.364 | 0.356–0.363 |
| overhead vs native | 1.01× | 1.02–1.03× |

Run-to-run drift on this machine is about ±0.03 ms for a browse parse, which is
larger than the difference between the two builds: that is why the honest
statement is "unchanged", not "improved".

With **every** filter switched on (the `hook-bench` configuration), a browse
response costs about **1.35× native**, or **+0.13 ms**; that is the price of ad
filtering, the Shorts/Live/shelf filters, the emoji rewrite and the thumbnail
upgrade, and it is paid once per response, not per frame. Per-feature:

| Case | Overhead on a 150 KiB response |
| --- | --- |
| Hook guards only | ~0 ms |
| Ad Blocking | +0.01 ms |
| + Load Rows Ahead (the defaults) | +0.006 ms |
| + Tracking Block | +0.09 ms |
| + Shorts/Live/shelf filters | +0.008 ms |
| + emoji fix | +0.04 ms |
| + DeArrow | **+0.64 ms** |
| + thumbnail upgrade | +0.09 ms |

DeArrow is the one expensive opt-in, because it walks every tile to rewrite a
title. It is off by default. Tracking Block is the second, because it rewrites
the response text before the parse; also off by default.

## 2. The settings panel: 65 ms → 11 ms

This is the change a user feels. The panel used to be built inside the
`keydown` handler of the menu key: 82 elements created, the Main page's styles
resolved and laid out, all before the first frame after the press. On webOS 3
the upstream measurement for the *four* pages it used to build was 170 ms; the
current Main-page-only build measured 65 ms in this harness.

Aura builds the panel while the TV is idle, 3.5 s after load, on a page that is
not playing video; the press then only flips `display: block`.

| First press of the menu key | upstream 0.8.5 | Aura |
| --- | --- | --- |
| Elements created in the handler | 82 | **0** |
| Handler wall time (ms) | 65.2 | **11.0–11.9** |
| Panel visible after the press | yes | yes |
| Pages built before the press | 0 | 1 (Main; the rest on open, one per frame) |

The ~11 ms is the tab focus, the focus trap, the keyboard handler and the
popup sync — the work that has to happen per open. The build itself
(`createOptionsPanel`) is the part that moved.

The trade is memory: about 120 DOM elements are held from 3.5 s until the
session ends, for a panel the user may never open. Measured as element count
only; the nodes are static, carry six event listeners between them, and are
never touched again. The four other pages are **not** prewarmed (~200 further
elements) because that would be real memory for a tab that may never be opened.

Prewarming is skipped entirely on the watch and Shorts pages: decode owns the
CPU there.

## 3. Bundle and package size

| | upstream 0.8.5 | Aura | Change |
| --- | --- | --- | --- |
| `userScript.js` | 243 801 B (238.1 KiB) | **226 931 B (221.6 KiB)** | **−16 870 B (−6.9 %)** |
| CSS in the bundle | 19 407 B | 17 644 B | −1 763 B |
| CSS selectors | 193 | 166 | −27 |
| Attribute-testing selectors | 22 | 16 | −6 |
| `index.js` (launcher) | 8 267 B | 8 267 B | — |
| `.ipk` (compressed) | 236 868 B (231.3 KiB) | **90 942 B (88.8 KiB)** | −61 % |

What left the bundle:

| Removed | Bytes (source) | Why |
| --- | --- | --- |
| `src/vendor/playback-speed/` (4 files) | ~71 KiB | needs WebCodecs (Chrome 94+) |
| `src/features/playback-speed/` (4 files) | ~16 KiB | ditto |
| `src/features/video-quality/kickstart.js` + absent stub | ~3 KiB | webOS 25 only |
| `src/features/block-webos-cast.ts` + absent stub | ~2 KiB | webOS 25 only |
| `src/core/speed-cap.js` | 0.6 KiB | only the speed feature set it |
| three theme logo PNGs (blue, red, dark) | ~12 KiB | one theme, one mark (0.7 KiB) |
| `theme-red.css`, `theme-oled.css` | ~3.5 KiB | folded into the Aura palette |
| the 0.8.5 artwork (4 PNGs) | 35.3 KiB | redrawn flat: 20.7 KiB total |

The install package is smaller again because the artwork is: the four PNGs went
from 35.3 KiB to 30.4 KiB of files, but they are now flat (no halo, no gradient),
which is exactly what deflate compresses to almost nothing — the whole `.ipk`
went from 231 KiB to 89 KiB.

## 4. Start-up

| | upstream 0.8.5 | Aura |
| --- | --- | --- |
| Module evaluation, median of 9 (ms) | 3.66 | 3.32–3.79 |
| Elements built at load | 3 | 3 |
| `<style>` elements at load | 2 | 2 |

Start-up is unchanged within noise. The bundle is 7 % smaller, which is 7 %
less to parse on a cold launch, but jsdom's compile dominates this measurement.
The one deliberate addition is a `setTimeout` at load (the panel prewarm), which
costs one timer entry for 3.5 s.

The app still builds almost nothing at load: the clock (one element) and the
toast container. Everything else is created when it is needed.

## 5. The emoji fix while scrolling

The emoji fix is the only feature that observes every DOM change, so its cost is
the one that would show up as jank. It scans only the outermost added element of
a batch, queues text nodes that actually contain a sentinel, and drains the
queue once per frame.

| 72 tiles added the way the renderer adds them | upstream 0.8.5 | Aura |
| --- | --- | --- |
| Plain titles, per frame | 0.12 ms | 0.14 ms |
| Two emoji per title, per frame | 0.93–1.30 ms | 0.91–1.50 ms |

The ranges are three runs each; the two bundles are indistinguishable, which is
the expected result — Aura did not change this code. It is recorded so a future
change can be judged against it.

At 60 fps a frame is 16.7 ms. One millisecond on a tile-heavy screen is the
largest single cost the app adds while scrolling, and it is why the emoji fix
remains switchable.

## 6. Memory and long sessions

- **MSE buffer cap** (`hooks/buffer-limit.js`): always on for this build. It
  trims already-played media beyond 30 s behind the playhead every 5 s, which
  keeps the source buffers well under Chromium 38's 150 MB video ceiling. This
  is the difference between a two-hour video finishing and LG's memory manager
  killing the app.
- **Per-video instances** (`core/per-video.js`): SponsorBlock and Return
  YouTube Dislike are built per video and disposed on the next one; their
  `destroy()` removes every listener, observer and timer through a disposables
  bag. The behaviour tests hold this (`sponsorblock-lifecycle-test`,
  `return-dislike-test`: a video change leaves no listener behind).
- **Caches with a ceiling**: the emoji token cache is 500 entries and trims its
  oldest half; the thumbnail verification cache is persisted and capped in
  `features/thumbnail-quality/cache.js`.
- **The panel prewarm** is the one deliberate addition: ~120 static elements.

Nothing in the app holds a reference to a video, a player or a response beyond
the video being watched.

## What was profiled and rejected

- **A `WeakMap` cache for `detectResponseType`.** Each response is parsed once,
  so a cache would never hit; the registry walk over nine signatures is already
  short-circuited by the first two properties.
- **Debouncing the emoji observer's `characterData` batch.** YouTube rewrites
  titles in place during scroll; a debounce would show the old text for a frame.
  The sentinel test (`WRAP_EMOJI_RE.test`) is cheaper than the bookkeeping.
- **A CSS containment layer per shelf (`contain: layout style`).** Chromium 38
  has no `contain`; the fallback is the same paint.
- **Rewriting YouTube's tile DOM to remove overlays.** Every removed node is a
  node YouTube's renderer re-creates, and the fight costs more than the paint.
  The overlays that Aura hides are hidden by CSS only.
- **Building the other four panel pages in the prewarm.** Measured: ~200 more
  elements held for the session. The pages build in four frames once the panel
  is open, which nobody sees.
- **`requestAnimationFrame`-batched focus handling.** The clock already
  debounces focus at 200 ms; a frame loop would wake the CPU every 16 ms during
  a video.

## Regression guards

These run in `npm test`, so a regression fails the build rather than the TV:

| Guard | Where |
| --- | --- |
| bundle ≤ 240 KiB, parses as ES5 | `tests/smoke/bundle-check.cjs` |
| no CSS Chromium 38 lacks (`var()`, `:focus-within`, 4/8-digit hex, `:is()`, un-prefixed `user-select`/`appearance`/`filter`, flex `gap`) | `tests/smoke/bundle-check.cjs` |
| no GPU filter (`blur`, `drop-shadow`) in the bundle | `tests/smoke/bundle-check.cjs` |
| no more than 40 inner IIFEs (a closure per item on the filter paths) | `tests/smoke/bundle-check.cjs` |
| the first panel open builds the Main page only, under 120 elements | `tests/behaviour/panel-test.cjs` |
| the emoji fix adds no mutation records to an idle page and at most 1.5× to in-place text churn | `tests/behaviour/emoji-font-test.cjs` |
| a video change leaves no SponsorBlock or dislike listener | `tests/behaviour/sponsorblock-lifecycle-test.cjs`, `return-dislike-test.cjs` |
| removed modules stay removed (markers) | `tests/smoke/bundle-check.cjs` |
