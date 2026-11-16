# YouTube Aura

A YouTube client for one television: the **LG OLED55B7V-Z** (2017, webOS 3.x,
Chromium 38). Ad-free, SponsorBlock, Return YouTube Dislike, DeArrow, and an
interface built around true black and a remote.

YouTube Aura is a fork of [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos)
by way of [NicholasBly/youtube-webos](https://github.com/NicholasBly/youtube-webos):
the hook layer, the feature set and the test suite come from there. What Aura
changes is the target — one 2017 panel instead of every webOS set from 2016 to
2025 — and everything that follows from it: one build, one engine, one theme,
and the work measured on that engine rather than assumed.

> **Status: not verified on hardware.** Everything in this repository is
> measured and tested in a simulated Chromium 38 environment (jsdom with a
> Chromium 38 profile, and the bundle parsed as strict ES5). It has **not** been
> run on an actual OLED55B7V. Read
> [Limitations](#limitations-and-what-is-not-verified) before installing.

---

## Why this exists

The upstream project supports webOS 3 through 25 from one source, which means
an alias table, two Babel dialects and a test suite that runs every feature
twice. On a 2017 TV that costs nothing at runtime but a great deal in review:
code that cannot run on this panel is still code you have to reason about.

The OLED55B7V is a specific machine. It has:

| | |
| --- | --- |
| Panel | 55" 4K OLED, true black, 120 Hz panel at 60 Hz input |
| SoC | M16P (LG's 2016/2017 generation), four weak cores |
| RAM | about 1 GB shared with the system |
| Engine | Chromium 38 — no `fetch`, no `AbortController`, no CSS custom properties, no `:focus-within`, no CSS Grid |
| Browser heap | small enough that a long video's MSE buffers have to be trimmed |

YouTube Aura is built for exactly that: ES5 output, one code path, a buffer cap
that is always on, and an interface whose animations are handed to the GPU
because the CPU is busy decoding.

## What it does

Everything the upstream fork did, minus what this TV cannot run:

- **Ad blocking** — response-side filtering of YouTube's InnerTube payloads,
  plus `isInlinePlaybackNoAd` on outgoing player requests.
- **SponsorBlock** — every category, per-category skip mode and colour, the
  segment list beside the settings, a progress-bar overlay, and the blue key to
  skip.
- **Return YouTube Dislike** — the count in the description panel, with the
  ratio bar.
- **DeArrow** — crowdsourced titles and thumbnails in place of clickbait
  (thumbnails on, title formatting off: the formatter needs `Intl` features this
  engine lacks, and it was removed, so titles keep the case they were written
  in).
- **Max Thumbnail Quality** — three strategies: original, fast, and a smooth SD
  mode tuned for row-to-row scrolling on this SoC.
- **Load Rows Ahead** — asks YouTube for the next rows before the last one, so
  a fast scroll never reaches an empty shelf.
- **Auto login / bypass nag screens**, guest-mode prompt hiding, endcard hiding,
  Shorts and Live filtering, the emoji and fancy-text fix, the search-font and
  multiline-title fixes.
- **Force Video Codec** and **Force Max Quality**.
- **Display Time in UI** — a clock that follows YouTube's own player UI.
- **OLED Screen Off** — the red key puts the panel to true black and keeps the
  TV awake.
- **Programmable shortcuts** on the digits and the red, green and blue keys.
- **Aura settings panel** on the green key: five tabs, arrow-key navigation, a
  focus trap, and every option the features above need.

Removed because this TV cannot use them (see [CHANGELOG.md](CHANGELOG.md)):
playback speed (needs WebCodecs, Chrome 94+), the webOS 25 cast block, the
webOS 25 first-play kickstart, the optional second UI theme, and the DeArrow
title formatter.

## Install

**Prerequisites:** the official YouTube app must be removed first — this app
takes its place (`youtube.leanback.v4`).

### Homebrew Channel (recommended)

Add this repository's `repo.json` as a source in the
[webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel),
or install the `.ipk` from the latest release directly.

### webOS CLI

```sh
ares-install youtube.leanback.v4_1.0.0_all_oled55b7v.ipk
```

The release page carries a `SHA256SUMS.txt`; check it first.

### Autostart (optional)

Registering the app as an input device makes it launch with the TV and start
much faster, at the cost of holding it in memory in the background:

```sh
luna-send-pub -n 1 'luna://com.webos.service.eim/addDevice' \
  '{"appId":"youtube.leanback.v4","pigImage":"","mvcdIcon":""}'
```

To undo it, use `deleteDevice` with the same app id.

## Using it

| Key | Does |
| --- | --- |
| 🟩 Green | Settings panel |
| 🟥 Red | OLED Screen Off (true black; the TV stays awake) |
| 🟦 Blue | SponsorBlock: skip the offered segment, or jump to the highlight |
| 5 | Next chapter |
| 0–9, red/green/blue | Programmable (Shortcuts tab) |

The panel opens with the tab bar focused; arrows move between controls by where
they sit on screen, Enter activates, Back closes. Left and Right step a value in
a `‹ value ›` row.

## What Aura changed, measured

Baseline is upstream `0.8.5` built as its legacy bundle; "Aura" is this
repository. Both measured in the same simulated Chromium 38 environment,
medians of repeated runs. The full record, including what was profiled and what
was rejected, and the honest caveats, is in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

| | upstream 0.8.5 (legacy) | Aura | |
| --- | --- | --- |
| Bundle | 238.1 KiB | **221.1 KiB** | −7.1 % |
| Install package (.ipk) | 231.3 KiB | **88.8 KiB** | flat artwork and one theme compress to almost nothing |
| CSS in the bundle | 19.4 KiB, 193 selectors | **17.6 KiB, 166 selectors** | −9 % |
| Opening the settings (first press) | 65.2 ms, 82 elements built in the handler | **11 ms, 0 elements in the handler** | the build runs while the TV is idle |
| `JSON.parse` of a 150 KiB home response, default settings | 1.01× native | **1.02× native** | unchanged: the hook was already cheap |
| `JSON.parse`, every filter on | 1.28× native | 1.35× native | unchanged within noise |
| Start-up (module evaluation) | 3.66 ms | 3.32–3.79 ms | unchanged within noise |
| Test suite | 1 383 checks, 3 upstream checks failing | **2 045 checks, 64 steps, all passing** | +662 checks |

The one number worth quoting is the settings press. Removing the playback-speed
step from the parse path was measured too, and it **did not move the parse
time**: that is recorded, not glossed over.

## The app

| | |
| --- | --- |
| Package | `youtube.leanback.v4` — **replaces** the stock YouTube app |
| Bundle | one, ES5, 224 KiB |
| Settings | in `localStorage`, `ytaf-configuration` |
| Network | `youtube.com`, `sponsor.ajay.app`, `returnyoutubedislikeapi.com`, `cdnjs.cloudflare.com` (emoji images) |
| Root | not required |

## Build it yourself

Needs Node.js 22.22.3 or newer.

```sh
npm ci
npm test            # formatting, lint, types, code map, the build, every test
npm run build       # dist/webOSUserScripts/userScript.js
npm run package     # dist/youtube.leanback.v4_1.0.0_all.ipk
npm run bench       # the five benchmarks, in one go
```

Deploy and launch on a TV with the webOS CLI configured
([instructions in docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

```sh
npm run deploy
npm run launch
```

## Documentation

| File | What it is |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is put together: the scripts, the hooks, the start-up order, the settings, the rules for this engine |
| [docs/CODEMAP.md](docs/CODEMAP.md) | Every module and function, what it calls and what calls it, which settings and selectors it touches (`npm run codemap`) |
| [docs/THEME.md](docs/THEME.md) | The Aura design system: palette, type, focus, motion budget |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | What was profiled, the numbers, what changed |
| [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) | The Chromium 38 contract and the API rules the code follows |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | The npm packages and their security status |
| [CHANGELOG.md](CHANGELOG.md) | Every change, with the Aura release notes at the top |

## Limitations and what is not verified

This is the honest list. Nothing below has been tested on an OLED55B7V.

**Not verified on hardware.** No test here ran on a real TV. The suite runs the
bundle on jsdom with a Chromium 38 profile (`tests/harness/chrome38-env.cjs`),
which reproduces the missing APIs and the ES5 syntax constraints, but not the
SoC's speed, the GPU's compositing, the memory limits or LG's media pipeline.
Frame timings and memory figures on the TV will differ from the numbers above.

**Depends on YouTube's markup.** Every class name and id the app reads is in
`core/selectors.js`. YouTube changes its TV client without notice; a change
breaks a feature until that table is updated. The app degrades rather than
crashing (each feature checks before it acts), but a feature can silently stop
working.

**DeArrow title formatting is gone.** The formatter needs `Intl.Segmenter` and
modern `Intl` casing that Chromium 38 lacks. Titles keep YouTube's own wording
(and the crowdsourced title when DeArrow has one, with the submitter's `>`
markers taken out); only crowdsourced *thumbnails* and titles are used, and the
settings panel has no formatting rows.

**No playback speed.** The speed engine needs WebCodecs (Chrome 94+). Removed
with its settings and shortcuts.

**The emoji fix is Twemoji from a CDN.** Emoji images load from
`cdnjs.cloudflare.com`; with no network, titles show the system glyphs instead.
The images are cached by the TV's own HTTP cache.

**SponsorBlock and DeArrow are third-party services.** Their availability,
latency and privacy practices are outside this project. SponsorBlock queries go
to `sponsor.ajay.app`, DeArrow's to `sponsor.ajay.app` and Return YouTube
Dislike's to `returnyoutubedislikeapi.com`; the video id is hashed before it is
sent where the API allows it.

**Account features depend on YouTube.** History, subscriptions and sign-in are
YouTube's own; the app only helps the account selector along.

**The Aura theme covers the app's own UI and YouTube's surfaces.** It restyles
the panel, the toasts, the clock and the black backgrounds behind YouTube's
content; it does not repaint YouTube's own controls, which keep YouTube's
design.

**One resolution, one engine.** The layout is sized in `vh`/`vw` and was
designed against a 1920×1080 panel. Another resolution is untested.

## Safety

- The app does not touch the TV's firmware, system services or other apps.
- It does not install itself: installation is an explicit step you take.
- It does not modify your data. Settings live in `localStorage` under
  `ytaf-configuration`, inside the app's own sandbox.
- It does not require root, though the Homebrew Channel path is easier with it.

## Licence and provenance

GPL-3.0-only, as the upstream projects are. The full text is in
[LICENSE](LICENSE). Authors and origins:

- [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos) — the
  original app, its hook design and most of the feature code.
- [NicholasBly/youtube-webos](https://github.com/NicholasBly/youtube-webos) — the
  fork this one starts from: the modular rewrite, the AdBlock engine, the
  SponsorBlock segment list, DeArrow support, the test suite, the code map.
- SponsorBlock by Ajay Ramachandran (GPL-3.0). Return YouTube Dislike by Dmitry
  Selivanov (GPL-3.0). DeArrow by Ajay Ramachandran (GPL-3.0).
- Twemoji by Twitter/X and contributors (CC-BY 4.0), via `@twemoji/api`.

Changes made for Aura are described in [CHANGELOG.md](CHANGELOG.md). Files
carried over keep their original comments and headers.
