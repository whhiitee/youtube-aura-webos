# Architecture

How YouTube Aura is put together: what runs where, in what order, and how the
parts talk to each other. Written for people and for AI agents opening the
project for the first time.

- **This file** is the overview, kept by hand.
- **[CODEMAP.md](CODEMAP.md)** is the generated map: every module and every
  named function, what it does, what it calls and what calls it, and which
  settings, events, YouTube selectors and browser hooks it touches. One page
  per folder in [codemap/](codemap/), the same data as JSON in
  [codemap.json](codemap.json). `npm run codemap` rebuilds it; `npm test`
  fails while it is out of date.
- **[THEME.md](THEME.md)** is the design system: the palette, the focus states,
  the type, the rules that keep an animation off the CPU.
- **[PERFORMANCE.md](PERFORMANCE.md)** is the measurement record: what was
  profiled, what it costs, what changed and what it bought.
- **[COMPATIBILITY.md](COMPATIBILITY.md)** is the single-device contract: the
  LG OLED55B7V's engine (Chromium 38, ES5) and the API rules the code follows.
- **[DEPENDENCIES.md](DEPENDENCIES.md)** covers the npm packages and their
  security status.

## One device, one build

YouTube Aura exists for one television: the **LG OLED55B7V-Z** (webOS 3.x,
firmware 06.10.65, platform M16P_DVB_EU, Chromium 38). Every decision below
follows from that:

| | |
| --- | --- |
| Engine | Chromium 38, `ES5` only, no custom properties, no `:focus-within`, no CSS Grid, no `fetch`, no `AbortController` |
| Build | one: `npm run build` → `dist/webOSUserScripts/userScript.js`, compiled to ES5 |
| Package | one: `npm run package` → `youtube.leanback.v4_<version>_all.ipk` |
| Installed as | `youtube.leanback.v4` — it **replaces** the official YouTube app |

Because there is exactly one engine, the source carries no second dialect. The
webOS 22+ build, the playback-speed engine (WebCodecs, Chrome 94+), the webOS 25
cast block and first-play kick, and DeArrow's title formatter (which needs an
`Intl` Chromium 38 does not have) were removed rather than kept behind an alias:
dead code costs a review and a test suite even when a build drops it. What
remains is one code path, measured on the engine it ships to.

## Two scripts

The app is a webOS web app with two scripts (`webpack.config.js`):

| Script | Runs in | Does |
| --- | --- | --- |
| `src/index.js` | the app's start page (`index.html`) | Sends the app to `https://www.youtube.com/tv` with the launch parameters (a deep link, a voice search), then is gone. |
| `src/userScript.js` | YouTube's TV site, injected by webOS (`webOSUserScripts/userScript.js`) | Everything else: the hooks, the features, the settings panel. |

The app **modifies YouTube's own page** rather than being an independent
client: webOS injects `userScript.js` into `youtube.com/tv` before the site's
own scripts run, and the app works by standing between YouTube's code and the
browser (the hooks below) and by adding its own DOM to `<body>`. Nothing about
YouTube's app is reimplemented, and nothing is downloaded that YouTube would not
have downloaded anyway.

## Folders

| Folder | What lives there |
| --- | --- |
| `src/core/` | Shared building blocks: settings (`config.js`, `config-options.js`), page state, the remote's keys, the webOS version, logging, DOM helpers, the YouTube selectors table, the InnerTube response shapes. No feature logic. |
| `src/hooks/` | Wrappers around browser built-ins that more than one feature uses: `fetch` (`fetch.ts`), YouTube's `resolveCommand` (`resolve-command.ts`), and the MSE buffer cap (`buffer-limit.js`). |
| `src/features/` | One folder (or file) per feature. A feature reads its settings, listens to page events and touches YouTube's page or responses. |
| `src/ui/` | The options panel (`panel/`), the remote shortcuts (`shortcuts/`), the toasts (`toast/`), the Aura theme (`styles/`). |
| `src/polyfills/` | What Chromium 38 lacks and the code uses. |
| `src/dev/` | The perf monitor, a development tool (`npm run build:perf`). |
| `tools/` | Build helpers (the CSS collector, the bare-require check), the code map generator, the bundle snapshot, the icon generator. |
| `tests/` | `run-all.mjs` runs everything: unit tests, behaviour tests on simulated webOS pages (jsdom, with a Chromium 38 profile), smoke tests on the built bundle, benchmarks. |

## Start-up order

`src/userScript.js` decides the order. Its imports run top to bottom, and each
feature module registers its listeners while it is imported:

```mermaid
flowchart TD
  A[polyfills.js] --> B[dev/perf-mon.js<br/>perf builds only]
  B --> C[whatwg-fetch]
  C --> D[feature modules imported<br/>return-dislike, video-quality, ui, sponsorblock,<br/>emoji-font, screensaver-fix, comments-fix, watch,<br/>lang-settings-fix: each registers its listeners]
  D --> E[global hooks installed<br/>JSON.parse, JSON.stringify, codec hooks, buffer limit]
  E --> F[initLogoStyle, startTrackingBlock]
  F --> G[launch params: account-selector bypass<br/>webOSRelaunch listener]
```

1. **Polyfills** first: `whatwg-fetch` checks at load whether `URLSearchParams`
   exists.
2. **perf-mon** (perf builds only) before everything else, so its probes sit
   underneath every other hook.
3. **The feature modules.** Importing one registers its page and setting
   listeners; the order of these imports is the order those listeners run in.
4. **The global hooks**, once every module has loaded (the codec filter runs
   inside the parse hook).
5. **Launch handling**: the account-selector bypass for a launch with
   parameters, and the `webOSRelaunch` listener (the app was opened again while
   running, for example from a voice search). A relaunch without a target
   (back from another app) leaves the page alone: going to `#/` would end
   SponsorBlock and the dislike counter for the video still playing.

`src/ui/index.js` (imported among the features) makes sure a key opens the
settings, sets the Aura classes on `<html>`, starts the panel's idle prewarm and
greets the user with a toast.

The buffer limit is installed unconditionally: this is a webOS 3 set, and the
cap is what keeps a two-hour video from being killed by LG's memory manager.

## The hooks

The app changes YouTube's behaviour mostly by standing between YouTube's code
and the browser:

| Hook | Installed by | Used for |
| --- | --- | --- |
| `JSON.parse` | `features/adblock/parse-hook.js` | Every InnerTube response YouTube parses: ad removal, the Shorts/Live/shelf filters, endcards, Load Rows Ahead, the codec filter, thumbnail upgrades, DeArrow, the emoji wrap. |
| `JSON.stringify` | `features/adblock/stringify-hook.ts` | Outgoing player requests: marks them `isInlinePlaybackNoAd` while Ad Blocking is on. |
| `window.fetch` | `hooks/fetch.ts` (`FetchRegistry`) | Listeners can see and cancel requests: Tracking Block cancels telemetry. Without listeners the original fetch is called directly. |
| `XMLHttpRequest.prototype.open/send` | `features/adblock/tracking-block.js` | Tracking Block: telemetry XHRs go to an empty `data:` URL. |
| `resolveCommand` on YouTube's app object | `hooks/resolve-command.ts` | `features/lang-settings-fix.ts`: a language change in YouTube's settings is written to the `PREF` cookie and the page reloads, which the TV app does not do by itself. |
| `MediaSource.isTypeSupported`, `HTMLMediaElement.prototype.canPlayType` | `features/force-codec/hooks.js` | Force Video Codec: declines the codecs the setting rules out. |
| `MediaSource.prototype.addSourceBuffer`, `SourceBuffer.prototype.appendBuffer`, `URL.createObjectURL` | `hooks/buffer-limit.js` | Trims already-played video from the buffers so the TV does not run out of memory on a long video. |

The table of every hook with the function that installs it is in
[CODEMAP.md](CODEMAP.md#hooks-and-diagnostics).

### How a response goes through the parse hook

`hookedParse` sees every `JSON.parse` call YouTube makes, thousands of them, so
it is built to cost nothing for the ones that do not matter:

```mermaid
flowchart TD
  P[JSON.parse text] --> S{string of 500+ chars?}
  S -- no --> N[native parse, return]
  S -- yes --> T[Tracking Block on: blank trackingParams in the text]
  T --> Q[native parse]
  Q --> R{InnerTube response?<br/>responseContext, playerResponse<br/>or continuationContents}
  R -- no --> X[return]
  R -- yes --> F[filterResponse]
  F --> F1[codec filter, if Force Video Codec is set]
  F1 --> F2[detect the response type<br/>core/innertube.js SCHEMA_REGISTRY]
  F2 --> F3[Load Rows Ahead, if on]
  F3 --> F4{any filter on?}
  F4 -- no --> X
  F4 -- yes --> F5[content filters: by schema, else the fallback search,<br/>else the guide's nav entries]
  F5 --> F6[thumbnail upgrade, DeArrow, emoji wrap]
  F6 --> X
```

The switches it reads are one snapshot (`features/adblock/flags.js`),
recomputed when a setting changes rather than read on every parse. Measured
cost with the default settings: **+0.004 ms on a 150 KiB home response**
(1.01× the native parse) — see [PERFORMANCE.md](PERFORMANCE.md).

## Pages, videos and the player

- **Page state** (`core/page-state.js`) watches the `<body>` classes YouTube
  sets (`WEB_PAGE_TYPE_WATCH` and so on) and dispatches `ytaf-page-update` when
  the kind of page changes. `isWatchPage()`, `isShortsPage()` and
  `isSearchPage()` read the same state.
- **Per-video instances** (`core/per-video.js`): SponsorBlock and Return
  YouTube Dislike get one instance per watched video, created when the watch
  page shows a video, kept across hash changes of the same video, destroyed
  when the video changes, off the watch page, on unload, and recreated when
  their setting changes. The live instance is reachable through
  `getSponsorBlock()` / `getReturnDislike()` and, for the TV's web inspector,
  `window.sponsorblock` / `window.returnYouTubeDislike`.
- **Player state**: `features/video-quality` attaches to YouTube's player on
  the watch page and re-publishes its state changes as `yt-player-state-change`;
  the clock and SponsorBlock follow it. `core/player-state.js` names the states.
- **Synthetic keys** (`core/remote.js` `sendKey`): some features press remote
  keys on the user's behalf (the account-selector bypass, the Shorts
  keep-alive, the chapter skip). Those events carry `SYNTHETIC_KEY_FLAG`, so
  the shortcut router and the panel ignore them.

## Settings

- `core/config-options.js` declares every setting: key, default, label. The
  [settings table](CODEMAP.md#settings) lists each one with the code that
  reads, writes or listens to it.
- `core/config.js` keeps them in memory (one localStorage entry,
  `ytaf-configuration`, read once and written back debounced).
  `configRead(key)` and `configWrite(key, value)` throw for a key that does not
  exist; `configAddChangeListener(key, fn)` is how a feature follows a setting.
- Hot paths do not call `configRead`: the ad block keeps a snapshot
  (`flags.js`), and the looks are classes on `<html>`
  (`ui/styles/html-classes.js`: `ytaf-aura`, `ytaf-oled`,
  `ytaf-oled-transparent-shelf`, `ytaf-remove-borders`, `ytaf-fix-titles`)
  that the stylesheets select on, so a change of setting is one class toggle.
- A setting from an older build that this one does not have is dropped on the
  next write (`buildConfig`). Aura retired `uiTheme` (there is one look now) and
  `enablePlaybackSpeed` (the engine it drove is gone).

## The settings UI and shortcuts

- **Panel** (`ui/panel/`): built while the TV is idle about 3.5 s after load
  (`schedulePrewarm`), so the menu key only shows it. The modal-free build cost
  up to 170 ms of one frozen keydown on webOS 3; the prewarm moves that work
  into a frame nobody waits on. If the press beats the prewarm, the panel
  builds synchronously and ignores toggles for half a second, as before. It has
  its own arrow-key navigation (`keyboard.js`), a focus trap (`focus-trap.js`),
  and controls bound to settings (`controls/`). The pages after Main are built
  one per frame.
- **Shortcuts** (`ui/shortcuts/`): `router.js` listens to `keydown` in the
  capture phase, before YouTube, and runs the action bound to the key
  (`actions.js`); the bindings are settings (`shortcut_key_*`).
- **Toasts** (`ui/toast/`): `showNotification(text, time, slot)`. A repeated
  text extends its toast; a slot (play/pause, the seek total) keeps one toast
  that changes in place.

## YouTube's markup

Every class name, id and tag of YouTube's page the code depends on is in one
table, `core/selectors.js` (`SELECTORS`). When YouTube changes its markup, the
fix goes there; [the selectors table](CODEMAP.md#youtube-selectors) shows which
functions use each entry. YouTube's six-letter class names are obfuscated and
change the most.

YouTube's TV app renders with its own virtual DOM and removes nodes it did not
create from its elements, so the app's own elements (the clock, the panel, the
toasts, the SponsorBlock overlay) live in `<body>` or are re-added when YouTube
re-renders.

## Diagnostics

- **Logging** (`core/log.js`): `createLogger('Tag')`. `debug` and `info` print
  only while diagnostics are on: `localStorage['ytaf-debug'] = '1'` (survives
  restarts) or `window.__ytaf_debug__ = true` (set in the TV's web inspector).
- **Counters** on `window` for the web inspector: `__ytafAdblockStats`,
  `__ytafThumbStats`, `__ytafQualityStats`, `__ytafContinuationStats` and, with
  diagnostics on, `__ytafBufferStats`.
- **perf-mon** (`npm run build:perf`): timings of every hook and feature, in an
  on-screen panel (press 0 three times) and in `window.__PERF` (`__PERF.help()`
  lists the API).

## Rules the code follows for this TV

These show up as comments across the source; keep to them when changing code,
and look for breaks of them when optimising:

- **Hot paths** (the parse and stringify hooks, focus listeners, the
  SponsorBlock time listener) return early for the common case, before any
  allocation or DOM query.
- **No `try` in a hot function**: webOS 3's engine (V8 3.28) does not optimise
  a function that contains one. Put the `try` in a small helper that only the
  rare case reaches (see `stringifyThenRestore`).
- **No options object for `addEventListener`**: Chromium 38 reads it as
  `useCapture: true`. Pass `true`/`false`, and no `{ once: true }`.
- **Babel helpers cost**: `for...of`, spread and array destructuring become
  helper calls in ES5. Plain indexed loops on hot paths.
- **Layout reads** (`getComputedStyle`, `getBoundingClientRect`, `offset*`)
  are cached or debounced; the code map's **Browser** line shows where they are.
- **Debounce by intent**: focus and key traffic is coalesced (the clock checks
  200 ms after the last focus change), while what must be exact (the clock
  following YouTube's controls, a SponsorBlock skip) is driven by an observer
  or a frame loop instead.
- **Clean up**: every instance keeps what it registered in a disposables bag
  (`core/disposables.js`) and `destroy()` undoes it, so leaving a video leaks
  no listener, observer or timer.

## Working on the project

- `npm test`: formatting, lint, types, the code map check, the build and
  every test script (ES5 and CSS compatibility included).
  `node tests/run-all.mjs --only=NAME` for one test script.
- `npm run codemap` after changing code. A new function needs a comment right
  above it saying what it does: that comment is its entry in the map.
- `npm run bench`: the hook, panel, start-up, emoji and parse-breakdown
  benchmarks. `npm run bundle:snapshot` / `bundle:compare` around a dependency
  update: they say whether the code that runs on the TV changed.
- Test builds: `npm run build -- --env build=2` shows "1.0.0 b2" in the
  settings heading.

### For AI agents

- Start from the [module table](CODEMAP.md#modules), then open the page of the
  folder you need in [codemap/](codemap/). Each page is small enough to read
  whole.
- To find everything touching a setting, an event, a YouTube selector or a
  hook, use the tables in CODEMAP.md, or query `docs/codemap.json`
  (`settings`, `events`, `selectors`, `hooks`, and `calls` / `calledBy` per
  function).
- Calls through a callback table or a parameter are not in the call graph
  (`ACTIONS[name].run(video)`, `sb.skipToPreviousSegment()`): search for the
  name as well.
- There is one build. A module is in the bundle if it is imported; a module
  that is only for newer TVs does not belong in this source at all.
