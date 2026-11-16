# Compatibility: the Chromium 38 contract

YouTube Aura runs in one place: the webOS 3.x browser of an LG OLED55B7V-Z,
which is **Chromium 38**. This file is the list of what that engine has, what it
does not, and the rules the source follows. `tests/smoke/bundle-check.cjs` and
`tests/unit/polyfill-conformance-test.cjs` enforce most of it; the rest is on
the reviewer.

## The device

| | |
| --- | --- |
| Model | OLED55B7V-Z (2017) |
| webOS | 3.x, firmware 06.10.65 |
| SDK | 3.9.0 |
| Platform | M16P_DVB_EU |
| Engine | Chromium 38 (V8 3.28) |
| Package id | `youtube.leanback.v4` |

The user agent carries `webOS.TV-2017`, which `core/webos.js` reads as webOS 3.

## JavaScript

Chromium 38 is ES5 plus a partial ES6. The build lowers everything to ES5, so
the question is not syntax but **runtime APIs**.

Missing, and used by this codebase — hand-written polyfills in `src/polyfills/`,
feature-detected, one group per file:

| API | Shipped in | File |
| --- | --- | --- |
| `fetch` | Chrome 42 | `whatwg-fetch` (npm) |
| `URLSearchParams`, `URL.searchParams` | Chrome 49 | `url-search-params.js` |
| `Object.assign` | Chrome 45 | `object.js` |
| `Object.entries` / `Object.values` | Chrome 54 | `object.js` |
| `Array.from` | Chrome 45 | `array.js` |
| `Array.prototype.find` / `findIndex` | Chrome 45 | `array.js` |
| `String.prototype.startsWith` | Chrome 41 | `string.js` |
| `Element.prototype.closest` | Chrome 41 | `dom.js` |
| `Node.prototype.isConnected` | Chrome 51 | `dom.js` |
| `AbortController` | Chrome 66 | not polyfilled: `core/fetch-timeout.js` races against a deadline instead |
| `requestIdleCallback` | Chrome 51 | guarded: `typeof` check, sync fallback |
| `IntersectionObserver` | Chrome 51 | guarded the same way |
| `ResizeObserver` | Chrome 64 | not used |
| `CSS.supports`, `Element.animate` (WAAPI) | Chrome 50 / 36 | not used |

Chromium 38 **has**: `Promise`, `Map`, `Set`, `WeakMap`, `Symbol`, `MutationObserver`,
`Intl.DateTimeFormat`, `JSON`, `localStorage`, `MediaSource`,
`SourceBuffer` (without the `SourceBuffer` global — see below), `performance.now`,
`requestAnimationFrame`.

The one engine quirk that changes how code is written: **V8 3.28 does not
optimise a function that contains a `try`**. Every hot function therefore keeps
its `try` in a small helper that only the rare path reaches —
`stringifyThenRestore` in the stringify hook, `filterSafely` in the parse hook.

### The bundle is checked as ES5

`tests/smoke/bundle-check.cjs` parses the built file with `acorn` at
`ecmaVersion: 5`. If Babel's targets ever slip, or a dependency ships ES6, the
test fails before the file goes near a TV.

## CSS

| Feature | Chromium 38 | Aura's answer |
| --- | --- | --- |
| Custom properties (`var()`) | no | literals; `docs/THEME.md` is the single list |
| `:focus-within` | no (59) | `panel/keyboard.js` puts `ytaf-focused` on the label row |
| CSS Grid | no (57) | flexbox; `pages.css` explains the exact choices |
| `gap` in flexbox | no (84) | `no-flex-gap` margins (`return-dislike.css`) |
| `#rrggbbaa`, `#rgba` | no (62) | `rgba()` |
| `:is()`, `:where()` | no (88) | plain selector lists |
| `::placeholder` | no (57) | not used |
| A list inside `:not()` | no (88) | separate rules |
| `appearance`, `user-select`, `filter` unprefixed | no | `-webkit-` form, via autoprefixer |
| `backdrop-filter` | no (76) | not used |
| `contain` | no (52) | not used |
| `position: sticky` | partial (56) | not used |
| Animating `transform`/`opacity` | yes, composited | the only two animations |

The checks in `bundle-check.cjs` grep the built stylesheet for each of these,
so an editor's autocomplete cannot quietly reintroduce one.

## Media

- **MediaSource Extensions** exist, but `SourceBuffer` is **not a global**.
  `hooks/buffer-limit.js` lifts the prototype off the first buffer instance to
  patch `appendBuffer`, and says so where it does it.
- **`video.playbackRate` is ignored** by the platform's media pipeline. That is
  why playback speed needed a timeline-rewriting engine, and why it is not in
  this build.
- **The buffer cap is mandatory.** Chromium 38 only collects a `SourceBuffer`
  at its own ceiling (150 MB video / 12 MB audio on this build), which is past
  what LG's memory manager tolerates. Aura trims 30 s behind the playhead every
  5 s.
- **Codecs**: the TV decodes VP9 and H.264/AVC at 4K; HEVC support depends on
  the firmware. `features/force-codec` can narrow the offer but the default
  (`auto`) is what the panel has always used.

## webOS APIs

The app touches the platform in exactly four ways, all of them documented
webOS 3 APIs:

| API | Used by | If missing |
| --- | --- | --- |
| `window.launchParams` | `core/launch.js` | treated as `{}` |
| `webOSRelaunch` event | `userScript.js` | the app never relaunches itself, which is fine |
| `luna-send-pub` (optional, for autostart) | the user, in a shell | not used at runtime |
| `sendKey`-style synthetic `KeyboardEvent`s | `core/remote.js` | features that press keys say they cannot |

No Luna service is called from the app. No root is required.

## What this build deliberately does not do

The following exist upstream and are **removed**, not hidden behind a setting:

| Feature | Why it cannot work here |
| --- | --- |
| Playback speed (0.25–2×) | needs WebCodecs (`AudioDecoder`), Chrome 94+ |
| webOS 25 Google Cast block | no cast receiver on webOS 3 |
| webOS 25 first-play kickstart | the webOS 3 player starts on its own |
| DeArrow title formatting | needs `Intl.Segmenter` and modern `Intl` text casing |
| Second UI theme | one theme by design |
| Translation layers | there is no second engine to translate for |

## Testing the contract

| What | Where |
| --- | --- |
| The bundle parses as ES5 | `tests/smoke/bundle-check.cjs` |
| The CSS uses nothing Chromium 38 lacks | `tests/smoke/bundle-check.cjs` |
| Every polyfill matches the native spec | `tests/unit/polyfill-conformance-test.cjs` (246 differential checks) |
| Features behave on a Chromium 38 page | `tests/harness/chrome38-env.cjs` + every `tests/behaviour/*` |
| The webOS version is read correctly | `tests/unit/core-webos-test.cjs` |

The harness's Chromium 38 profile deletes `fetch`, `AbortController`,
`requestIdleCallback` and `IntersectionObserver`, seals the `NodeList` and
`HTMLCollection` prototypes, and lowers `Element` methods — so a feature that
reaches for a newer API fails a test rather than the TV.
