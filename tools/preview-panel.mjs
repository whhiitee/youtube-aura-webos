/**
 * Renders the options panel the bundle actually builds into a standalone HTML
 * file, so its look can be looked at (and screenshotted) without a TV.
 *
 * The panel is built by the bundle in a jsdom page, exactly as the behaviour
 * tests build it; this script then writes the page's own <style> element and the
 * panel's DOM into one file, on a black backdrop. Nothing here is
 * hand-written: what you see is what createOptionsPanel() produced.
 *
 *   YTAF_PREVIEW_OUT=docs/panel-preview.html node tools/preview-panel.mjs
 *
 * (The path comes from the environment because the test harness reads its first
 * argument as the bundle to load.) Not part of the build or the test suite.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.env.YTAF_PREVIEW_OUT || resolve(root, 'docs', 'panel-preview.html'));

const { createPage } = require(resolve(root, 'tests', 'harness', 'page.cjs'));

const page = createPage({
  config: {
    enableLegacyEmojiFix: true,
    enableSponsorBlock: true,
    enableReturnYouTubeDislike: true,
    enableAutoLogin: true
  },
  fetch: false,
  timers: { scale: 10, from: 500 }
});
const { win, pump } = page;
const d = win.document;

// Everything the bundle put in the page, and the panel on top of it.
setTimeout(() => {
  win.ytaf_showOptionsPanel(true);
  for (let i = 0; i < 30; i++) pump();

  const style = Array.from(d.querySelectorAll('style'))
    .map((s) => s.textContent)
    .join('\n');
  const panel = d.querySelector('.ytaf-ui-container');
  if (!panel) {
    console.error('The bundle built no panel.');
    process.exit(1);
  }
  // The tab bar's first tab holds the focus on open; show the Main page with a
  // cycle row focused, which is the state a user sees after one Down.
  const firstRow = panel.querySelector('#ytaf-page-main .ytaf-cycle-row');
  const pages = panel.querySelectorAll('.ytaf-settings-page');
  for (let i = 0; i < pages.length; i++) pages[i].style.display = i === 0 ? 'block' : 'none';

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><title>YouTube Aura panel</title>' +
    '<style>' +
    'html,body{margin:0;height:100%;background:#0b0b0d;}' +
    // A stand-in for the picture the panel floats over.
    'body{background-image:radial-gradient(circle at 30% 40%, #1b2436 0%, #0b0b0d 60%);}' +
    style +
    '</style></head><body>' +
    panel.outerHTML +
    '</body></html>';

  writeFileSync(out, html);
  console.log(`Wrote ${out} (${(html.length / 1024).toFixed(1)} KiB)`);
  if (firstRow) console.log(`First cycle row: ${firstRow.textContent.trim().replace(/\s+/g, ' ')}`);
  process.exit(0);
}, 900);
