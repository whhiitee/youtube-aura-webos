/**
 * Measures the Legacy Emoji Fix's scanning cost on a realistic home screen: a
 * shelf of tiles added the way YouTube's renderer adds them (a container, then
 * its children, in batches), with and without emoji in the titles, and the
 * per-frame drain of the text-node queue.
 *
 * This is the one feature that watches every DOM change on webOS 3, so its
 * cost is the one that shows up as jank while scrolling. A measurement, not a
 * check: run it before and after a change and compare.
 *
 * Run after `npm run build`: node tests/bench/emoji-bench.cjs [bundle] [label]
 */
const { createPage } = require('../harness/page.cjs');
const { flush } = require('../harness/fixtures.cjs');

const label = process.argv[3] || 'aura';
const ZWSP = String.fromCharCode(0x200b);
const ZWNJ = String.fromCharCode(0x200c);
const wrap = (emoji) => ZWSP + emoji + ZWNJ;

/**
 * Adds `rows` shelves of `perRow` tiles, one element at a time as the renderer
 * does, and returns the wall time of adding them plus the frames it took.
 */
async function scrollRun(emoji) {
  const page = createPage({ config: { enableLegacyEmojiFix: true } });
  const { win, pump } = page;
  const d = win.document;
  const app = d.querySelector('ytlr-app');
  const ROWS = 6;
  const PER_ROW = 12;

  // Settle the page first: the observer is armed and the empty app scanned.
  for (let i = 0; i < 3; i++) {
    pump();
    await flush();
  }

  const t0 = process.hrtime.bigint();
  let frames = 0;
  for (let r = 0; r < ROWS; r++) {
    const row = d.createElement('div');
    app.appendChild(row);
    for (let i = 0; i < PER_ROW; i++) {
      const tile = d.createElement('div');
      const title = d.createElement('span');
      title.textContent = emoji
        ? `Video ${r}-${i} ${wrap('🎵')} lofi ${wrap('😀')}`
        : `Video ${r}-${i} a plain title with some words`;
      tile.appendChild(title);
      row.appendChild(tile);
      // The renderer adds tiles one at a time and yields between batches.
      if (i % 4 === 3) {
        pump();
        frames++;
        await flush();
      }
    }
  }
  // Drain what is queued.
  for (let i = 0; i < 10; i++) {
    pump();
    frames++;
    await flush();
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return {
    ms,
    frames,
    injected: d.querySelectorAll('.twemoji-injected').length,
    nodes: d.getElementsByTagName('*').length
  };
}

(async () => {
  // Warm up: the first page pays for compiling the bundle in the vm.
  await scrollRun(false);
  const plain = await scrollRun(false);
  const withEmoji = await scrollRun(true);

  console.log(`\n=== the emoji fix while scrolling, ${label} bundle ===`);
  console.log(`72 plain titles added     : ${plain.ms.toFixed(1)} ms over ${plain.frames} frames`);
  console.log(
    `72 titles with 2 emoji    : ${withEmoji.ms.toFixed(1)} ms over ${withEmoji.frames} frames`
  );
  console.log(`                           ${withEmoji.injected} emoji spans rendered`);
  console.log(`per frame, plain          : ${(plain.ms / plain.frames).toFixed(2)} ms`);
  console.log(`per frame, with emoji     : ${(withEmoji.ms / withEmoji.frames).toFixed(2)} ms`);
  process.exit(0);
})();
