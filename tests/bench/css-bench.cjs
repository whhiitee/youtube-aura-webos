/**
 * What the app's single stylesheet costs the engine: its size, how many rules
 * it holds, and how many of those rules are unconditional (matched against
 * every element on every style recalc) against scoped ones. A measurement, not
 * a check.
 *
 * Chromium 38 matches every rule against every element whose style it
 * recalculates. A rule like `.ytaf-toast` is cheap (one class test); a rule
 * `body [idomkey='shadow']` is tested against every element in the app. This
 * counts both, so a change that adds selectors can be judged by what it adds.
 *
 * Run after `npm run build`: node tests/bench/css-bench.cjs [bundle] [label]
 */
const { createPage } = require('../harness/page.cjs');

const label = process.argv[3] || 'aura';

const page = createPage({ config: { enableLegacyEmojiFix: true } });
setTimeout(() => {
  const { win } = page;
  const sheets = Array.from(win.document.querySelectorAll('style'));
  const css = sheets.map((s) => s.textContent).join('\n');

  // Crude but honest: a rule is the text between a `}` (or the start) and the
  // next `{`. At-rules with a block of their own (`@keyframes`) are separated.
  const blocks = css.split('}');
  let rules = 0;
  let attributeSelectors = 0;
  let universal = 0;
  for (const block of blocks) {
    const at = block.lastIndexOf('{');
    if (at === -1) continue;
    const selector = block.slice(0, at).trim();
    if (!selector || selector.startsWith('@')) continue;
    const parts = selector.split(',');
    rules += parts.length;
    for (const part of parts) {
      if (/\[[^\]]+\]/.test(part)) attributeSelectors++;
      if (/(?:^|[\s>+~])\*/.test(part)) universal++;
    }
  }

  console.log(`=== the stylesheet, ${label} bundle ===`);
  console.log(`<style> elements        : ${sheets.length}`);
  console.log(`CSS bytes               : ${Buffer.byteLength(css)}`);
  console.log(`selectors               : ${rules}`);
  console.log(`  with an attribute test: ${attributeSelectors}`);
  console.log(`  with a universal (*)  : ${universal}`);
  process.exit(0);
}, 500);
