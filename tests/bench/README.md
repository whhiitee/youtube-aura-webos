# Benchmarks

Measurements, not checks: nothing here fails the build. They say what a change
cost, and `docs/PERFORMANCE.md` records the numbers and what was done with them.

Run all of them after a build:

```sh
npm run build
npm run bench
```

or one at a time. The optional first argument is a bundle to measure instead of
`dist/`, which is how the upstream baseline was measured:

```sh
node tests/bench/hook-bench.cjs "C:\path\to\0.8.5\userScript.js" legacy
```

| Script | Measures |
| --- | --- |
| `hook-bench.cjs` | the `JSON.parse` / `JSON.stringify` hooks against the natives, with every filter on (the worst case) |
| `parse-breakdown.cjs` | the same parse with the filters switched on one at a time, so a change is judged by the row it moves |
| `panel-bench.cjs` | the settings panel's first open: cold (the press builds it) and prewarmed (built while the TV is idle) |
| `boot-bench.cjs` | module evaluation at load, elements built, `<style>` elements |
| `emoji-bench.cjs` | the emoji fix scanning a 72-tile home screen, with and without emoji in the titles |
| `css-bench.cjs` | the joined stylesheet: bytes, selector count, attribute and universal selectors |

The environment is jsdom with a Chromium 38 profile, on a desktop CPU. It
reproduces the engine's constraints, not the TV's speed: the ratios and the byte
counts are what to trust, and the absolute milliseconds are an upper bound.

`baseline-0.8.5.json` and `baseline-aura-1.0.0.json` hold the recorded runs, with
the commit and the date. A baseline bundle for re-measuring goes in
`tests/bench/baseline/`, which git ignores.
