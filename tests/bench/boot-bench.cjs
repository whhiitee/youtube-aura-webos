/**
 * Measures the cost of the bundle's own start-up: the time from evaluating the
 * script to the point where its modules have registered, plus what it built in
 * the page and how much work it scheduled. A measurement, not a check.
 *
 * The TV runs the same script from its storage on every cold launch, so this
 * number is what the user waits for before YouTube's own UI appears; it is the
 * reason the bundle is trimmed and the reason nothing heavy runs at load.
 *
 * Run after `npm run build`: node tests/bench/boot-bench.cjs [bundle] [label]
 */
const { createPage } = require('../harness/page.cjs');

const label = process.argv[3] || 'aura';
const REPS = 9;

/** One boot on a browse page, timed from the script's first line to its last. */
function boot() {
  const page = createPage({
    config: {
      enableLegacyEmojiFix: true,
      enableSponsorBlock: true,
      enableReturnYouTubeDislike: true,
      enableAutoLogin: true,
      enableOledCareMode: true,
      enableRowsAhead: true
    },
    autoRun: false
  });
  const win = page.win;
  const before = win.document.getElementsByTagName('*').length;
  const t0 = process.hrtime.bigint();
  const error = page.run();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (error) throw error;
  return {
    ms,
    elements: win.document.getElementsByTagName('*').length - before,
    styles: win.document.querySelectorAll('style').length,
    // The page the bundle put in <html>, which is one class read for every
    // selector rule it matches.
    htmlClasses: win.document.documentElement.className
  };
}

// A warm-up boot, then the median: the first run pays for compiling the script
// in the vm, which the TV pays once per launch and this measures every time.
boot();
const runs = [];
for (let i = 0; i < REPS; i++) runs.push(boot());
runs.sort((a, b) => a.ms - b.ms);
const median = runs[runs.length >> 1];

console.log(`=== start-up, ${label} bundle ===`);
console.log(`module evaluation, median of ${REPS}   : ${median.ms.toFixed(2)} ms`);
console.log(`                          fastest      : ${runs[0].ms.toFixed(2)} ms`);
console.log(`elements built at load                 : ${median.elements}`);
console.log(`<style> elements                       : ${median.styles}`);
console.log(`<html> classes                         : ${median.htmlClasses}`);
process.exit(0);
