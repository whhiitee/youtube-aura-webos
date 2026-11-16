/**
 * The built bundle as a file: it parses as ES5, it stays within its size
 * budget, and the stylesheets it carries use nothing Chromium 38 lacks.
 *
 * YouTube Aura has one build. Its engine is the LG OLED55B7V's: webOS 3.x,
 * Chromium 38, plain ES5. What the Babel configuration promises is what
 * nothing else verifies, so this script is the gate on both.
 *
 * Run: node tests/smoke/bundle-check.cjs [bundle]
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { createReport } = require('../harness/report.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const bundlePath = process.argv[2] || path.join(ROOT, 'dist/webOSUserScripts/userScript.js');

// ecmaVersion: what the engine parses, as acorn is told to accept it.
// budget: the size in bytes the built file must stay under. 240 KiB was the
// 0.8.5 legacy budget; Aura removed the webOS 22+ modules (the speed engine,
// the cast block, the kick) and the second theme's three logo PNGs, and the
// build sits below 230 KiB.
// iifeLimit: how many function expressions called on the spot may sit inside
// another function (see the check below).
const SPEC = { ecmaVersion: 5, budget: 240 * 1024, iifeLimit: 40 };

const report = createReport();

const source = fs.readFileSync(bundlePath, 'utf8');
const bytes = Buffer.byteLength(source);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

let parses = false;
let detail = '';
let ast = null;
try {
  ast = acorn.parse(source, { ecmaVersion: SPEC.ecmaVersion, sourceType: 'script' });
  parses = true;
} catch (e) {
  const near = e.pos == null ? '' : ` near "${source.slice(Math.max(0, e.pos - 60), e.pos + 60)}"`;
  detail = e.message + near;
}
report.check(`the bundle parses as ES${SPEC.ecmaVersion} (Chromium 38)`, parses, detail);

/**
 * Function expressions called on the spot inside another function: each is a
 * closure created on every call of the one around it. The minifier makes them
 * out of helpers with one caller unless told not to (reduce_funcs), and on
 * the filter and walk paths that meant one or more per item.
 */
function innerIifes(root) {
  let count = 0;
  const visit = (node, inFunction) => {
    if (node.type === 'CallExpression' && /^(?:Arrow)?FunctionExpression$/.test(node.callee.type)) {
      if (inFunction) count++;
    }
    const nested = inFunction || /Function/.test(node.type);
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child, nested);
        }
      } else if (value && typeof value.type === 'string') {
        visit(value, nested);
      }
    }
  };
  // The webpack runtime wraps everything in one function: its body is the top level.
  visit(root, false);
  return count;
}
if (ast) {
  // The bundle's own wrapper and the module functions are functions too:
  // the count starts inside them, so the limit allows for the runtime's.
  const n = innerIifes(ast);
  report.check(
    `at most ${SPEC.iifeLimit} function expressions called on the spot inside functions`,
    n <= SPEC.iifeLimit,
    `${n} found`
  );
}

// The stylesheets ride in the bundle as strings; they must not use what
// Chromium 38 lacks: custom properties, :focus-within, 4- and 8-digit hex
// colours, :is(), :where(), ::placeholder, a list inside :not(), and
// user-select, appearance or filter without the -webkit- form beside it. A
// flex gap is ignored there, so each one needs its no-flex-gap margins.
const issues = [];
const count = (re) => (source.match(re) || []).length;
if (/var\(--/.test(source)) issues.push('var(--');
if (/:focus-within/.test(source)) issues.push(':focus-within');
if (/#[0-9a-f]{8}(?![0-9a-f])/i.test(source)) issues.push('#rrggbbaa');
if (/#[0-9a-f]{4}\b/i.test(source)) issues.push('#rgba');
if (/:is\(|:where\(/.test(source)) issues.push(':is() or :where()');
if (/::placeholder/.test(source)) issues.push('::placeholder');
if (/:not\([^)]*,/.test(source)) issues.push('a list inside :not()');
if (count(/(^|[^-\w])gap:/g) > count(/no-flex-gap[^{]*\{[^}]*margin/g)) {
  issues.push('a flex gap without no-flex-gap margins');
}
for (const prop of ['user-select', 'appearance', 'filter']) {
  const plain = (source.match(new RegExp('(^|[^-\\w])' + prop + ':', 'g')) || []).length;
  const webkit = (source.match(new RegExp('-webkit-' + prop + ':', 'g')) || []).length;
  if (plain > webkit) issues.push(`${prop} without -webkit-`);
}
// A transform and an animation that only moves opacity or a 2D transform are
// composited; anything else here is the TV's CPU painting frames instead of
// decoding video.
if (/filter:\s*(?:blur|drop-shadow)/.test(source)) issues.push('a GPU filter');
report.check('the CSS uses nothing Chromium 38 lacks', issues.length === 0, issues.join(', '));

// core/styles.js joins every stylesheet into one <style>, where an @import
// that is not first is ignored: anything the bundle needs from outside
// goes in as a <link>.
report.check('the bundled CSS carries no @import', !/@import/.test(source));

// Chromium 38 has Symbol: Babel's typeof helper would only add a call to
// every typeof on the hot paths. Babel's own class-key helpers keep a few.
const helper = /function ([\w$]+)\([\w$]+\)\{return \1="function"==typeof Symbol/.exec(source);
const helperCalls = helper
  ? (source.match(new RegExp('(?:^|[^\\w$])' + helper[1].replace(/\$/g, '\\$') + '\\(', 'g')) || [])
      .length
  : 0;
report.check(
  "typeof is the engine's own, not Babel's helper (Chromium 38 knows 'symbol')",
  helperCalls <= 8,
  `${helperCalls} uses of the helper`
);

// What the build leaves out, each by a string only that code puts in the
// bundle. A marker must be absent, so a removed module that creeps back in is
// caught here rather than on the TV.
const REMOVED = [
  ['the playback speed engine', 'PlaybackSpeed'],
  ['the webOS 25 cast block', 'wake_cast_core'],
  ['the webOS 25 first-video kick', 'playback enforcer'],
  ['the second UI theme (Classic Red)', 'classic-red'],
  ['the per-theme logo PNGs', 'ytaf-logo-red']
];
for (const [what, marker] of REMOVED) {
  report.check(`left out: ${what}`, source.indexOf(marker) === -1, marker);
}

// The features that must be in the bundle, by a string only they put there.
const KEPT = [
  ['Ad Blocking', 'isInlinePlaybackNoAd'],
  ['SponsorBlock', 'sponsor.ajay.app'],
  ['Return YouTube Dislike', 'returnyoutubedislikeapi'],
  ['DeArrow', 'dearrow'],
  ['the OLED buffer limit', '__ytafTrimming'],
  ['the legacy emoji fix', 'twemoji-injected'],
  ['the fetch polyfill', 'Network request failed']
];
for (const [what, marker] of KEPT) {
  report.check(`kept: ${what}`, source.indexOf(marker) !== -1, marker);
}

// The panel heading's version (src/core/version.js), as webpack wrote it: the
// test-build workflow sets YTAF_BUILD, and the label carries it then.
const { version } = require(path.join(ROOT, 'package.json'));
const label = version + (process.env.YTAF_BUILD ? ` b${process.env.YTAF_BUILD.trim()}` : '');
report.check(
  `the bundle names its version in the panel heading ("YouTube Aura" + ${label})`,
  source.indexOf('YouTube Aura') !== -1 && source.indexOf(label) !== -1
);

report.note(`bundle: ${bytes} bytes (${kb(bytes)}), budget ${kb(SPEC.budget)}`);
report.check(
  `the bundle is within its ${kb(SPEC.budget)} budget`,
  bytes <= SPEC.budget,
  `${bytes} bytes is ${kb(bytes - SPEC.budget)} over`
);
report.finish();
