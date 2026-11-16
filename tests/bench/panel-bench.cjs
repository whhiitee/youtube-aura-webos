/**
 * Measures the cost of opening the options panel: the wall time of the keydown
 * handler that builds and shows it, and the elements created in that handler
 * against those created in the frames after it, where the other three pages
 * are built. On a webOS 3 capture the synchronous build of all four pages was
 * one 170 ms call and an fps drop from 60 to 32; element creation and the
 * style and layout work behind it is what costs on Chromium 38.
 *
 * The second half measures the prewarmed path (ui/panel/panel.js
 * schedulePrewarm): the panel is built while the TV is idle, so the press only
 * shows it. That is the number the user feels.
 *
 * A measurement, not a check: tests/behaviour/panel-test.cjs holds the budget.
 *
 * Run after `npm run build`: node tests/bench/panel-bench.cjs [bundle]
 */
const { createPage } = require('../harness/page.cjs');
const { countCreated, press, KEYS, wait } = require('../harness/fixtures.cjs');

const PREWARM_DELAY_MS = 3500;

/** One page with the panel watched for created elements. */
function boot(pageOptions) {
  let counter;
  const page = createPage(
    Object.assign(
      {
        config: {
          enableLegacyEmojiFix: true,
          enableSponsorBlock: true,
          enableReturnYouTubeDislike: true,
          enableAutoLogin: true
        },
        setup(win) {
          counter = countCreated(win);
        }
      },
      pageOptions
    )
  );
  return { page, counter };
}

/** The elements per page, once everything has settled. */
function report(panel) {
  const count = (sel) => {
    const p = panel && panel.querySelector(sel);
    return p ? p.getElementsByTagName('*').length : 0;
  };
  console.log('\nelements per page (after everything settles):');
  for (const [name, sel] of [
    ['Main', '#ytaf-page-main'],
    ['SponsorBlock', '#ytaf-page-sponsor'],
    ['Shortcuts', '#ytaf-page-shortcuts'],
    ['UI Tweaks', '#ytaf-page-ui-tweaks']
  ]) {
    console.log(`  ${name.padEnd(13)} ${String(count(sel)).padStart(4)}`);
  }
  console.log(
    `  ${'TOTAL panel'.padEnd(13)} ${String(panel ? panel.getElementsByTagName('*').length : 0).padStart(4)}`
  );
}

(async () => {
  // ---- the cold path: the first press builds the panel -------------------------
  {
    const { page, counter } = boot();
    const { win } = page;
    await wait(600); // past the first frames, before the prewarm delay
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const before = counter.created;
    const t0 = process.hrtime.bigint();
    press(win, KEYS.GREEN, win.document.body);
    const openMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const inHandler = counter.created - before;

    const panel = win.document.querySelector('.ytaf-ui-container');
    console.log('=== opening the options panel: cold (press builds it) ===');
    console.log(`panel visible after the keypress : ${!!panel && panel.style.display === 'block'}`);
    console.log(`createElement calls IN the handler: ${inHandler}`);
    console.log(`handler wall time                 : ${openMs.toFixed(2)} ms`);

    const beforeDeferred = counter.created;
    for (let f = 0; f < 30; f++) {
      page.pump();
      await tick();
    }
    console.log(
      `createElement calls deferred to later frames: ${counter.created - beforeDeferred}`
    );
    report(panel);
  }

  // ---- the prewarmed path: the panel was built while idle ----------------------
  {
    // The prewarm waits PREWARM_DELAY_MS and the panel's first build no longer
    // blocks toggles for half a second.
    const { page, counter } = boot({ timers: { scale: 1, from: PREWARM_DELAY_MS } });
    const { win } = page;
    await wait(PREWARM_DELAY_MS + 250);
    // The prewarm's page chain runs one page per frame; give it the frames a
    // TV would give it.
    for (let f = 0; f < 8; f++) page.pump();
    const panel = win.document.querySelector('.ytaf-ui-container');
    const prebuilt = !!panel;
    const before = counter.created;
    const t0 = process.hrtime.bigint();
    press(win, KEYS.GREEN, win.document.body);
    const openMs = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log('\n=== opening the options panel: prewarmed (built while idle) ===');
    console.log(`panel built before the press     : ${prebuilt}`);
    console.log(`createElement calls IN the handler: ${counter.created - before}`);
    console.log(`handler wall time                 : ${openMs.toFixed(2)} ms`);
    console.log(`panel visible after the keypress : ${!!panel && panel.style.display === 'block'}`);
    // Only the shell and the Main page: the rest build once the panel shows.
    const pages = [
      '#ytaf-page-main',
      '#ytaf-page-sponsor',
      '#ytaf-page-shortcuts',
      '#ytaf-page-ui-tweaks'
    ];
    console.log(
      `pages built by the prewarm        : ${pages.filter((p) => win.document.querySelector(p)).length}/${pages.length} (the rest build when the panel opens)`
    );
  }

  process.exit(0);
})();
