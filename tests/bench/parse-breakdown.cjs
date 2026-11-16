/**
 * Where the parse hook's time goes: the same browse response timed with the
 * filters off one at a time, so a change is judged by the row it actually
 * moves. The hook is the one thing that runs on every InnerTube response, and
 * an ad-free home screen parses hundreds of them per session.
 *
 * A measurement, not a check. Run after `npm run build`:
 *   node tests/bench/parse-breakdown.cjs [bundle] [label]
 */
const { createPage } = require('../harness/page.cjs');
const { makeBrowse } = require('../harness/gen-payload.cjs');

const label = process.argv[3] || 'aura';

// Each case is a full configuration: the defaults a fresh install has, with
// one feature changed. `baseline` is everything off, which leaves the hook's
// own guards (the size gate, the response-type detection, the rows-ahead pass).
const CASES = [
  ['everything off (hook guards only)', { enableAdBlock: false, enableRowsAhead: false }],
  ['Ad Blocking only', { enableAdBlock: true, enableRowsAhead: false }],
  ['Ad Blocking + Rows Ahead (defaults)', { enableAdBlock: true, enableRowsAhead: true }],
  [
    'defaults + Tracking Block',
    { enableAdBlock: true, enableRowsAhead: true, enableTrackingBlock: true }
  ],
  [
    'defaults + Shorts/Live/shelf filters',
    {
      enableAdBlock: true,
      enableRowsAhead: true,
      removeGlobalShorts: true,
      removeLiveVideos: true,
      removeTopLiveGames: true,
      removeMostRelevant: true
    }
  ],
  [
    'defaults + emoji fix',
    { enableAdBlock: true, enableRowsAhead: true, enableLegacyEmojiFix: true }
  ],
  ['defaults + DeArrow', { enableAdBlock: true, enableRowsAhead: true, enableDeArrow: true }],
  [
    'defaults + thumbnail upgrade',
    { enableAdBlock: true, enableRowsAhead: true, upgradeThumbnails: true }
  ]
];

/** Milliseconds per parse of `text`, medians of interleaved runs. */
function timeParses(text, config) {
  const page = createPage({ ua: 'webos3', raf: 'timeout', config });
  const { win, NS: nativeStringify, NP: nativeParse } = page;
  const hooked = win.JSON.parse;
  const benchText = nativeStringify(text);

  const REPS = 7;
  const once = (fn, iters) => {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iters; i++) fn();
    return Number(process.hrtime.bigint() - t0) / 1e6 / iters;
  };
  const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];

  for (let i = 0; i < 30; i++) {
    hooked(benchText);
    nativeParse(benchText);
  }
  const hs = [];
  const ns = [];
  for (let r = 0; r < REPS; r++) {
    hs.push(once(() => hooked(benchText), 40));
    ns.push(once(() => nativeParse(benchText), 40));
  }
  return { hooked: median(hs), native: median(ns) };
}

setTimeout(() => {
  const browse = makeBrowse();
  console.log(`=== parse breakdown, ${label} bundle (browse response) ===`);
  console.log('case                                     hooked(ms)  overhead(ms)  x native');
  for (const [name, config] of CASES) {
    const r = timeParses(browse, config);
    console.log(
      name.padEnd(40),
      r.hooked.toFixed(4).padStart(10),
      (r.hooked - r.native).toFixed(4).padStart(13),
      (r.hooked / r.native).toFixed(2).padStart(9)
    );
  }
  process.exit(0);
}, 500);
