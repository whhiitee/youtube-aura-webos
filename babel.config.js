/**
 * Babel config for the one build: the LG OLED55B7V (webOS 3.x, Chromium 38).
 * Everything is lowered to ES5, types are stripped, and Babel's helper
 * functions are deduped into a shared runtime instead of re-emitted per module.
 *
 * Babel 8: preset-env has no `bugfixes` (always on) or `useBuiltIns` (gone, see
 * below) options any more, and plugins reject options they do not know.
 *
 * This config deliberately does NOT use babel-plugin-polyfill-corejs3.
 * See the header of src/polyfills/polyfills.js for the reasoning: core-js
 * considers Chromium 38 to need 386 modules (~334 KiB) because it re-implements
 * every built-in with any spec deviation, and `usage-pure` mode additionally
 * rewrites every `arr.slice(x)` call site into
 * `_sliceInstanceProperty(arr).call(arr, x)` — permanent runtime overhead on
 * the slowest devices we support.
 *
 * src/polyfills/polyfills.js hand-implements the built-ins Chromium 38 lacks
 * and this codebase uses. userScript.js imports it before every feature
 * module, so ordering is guaranteed.
 *
 * regenerator: async/await is lowered to generators by preset-env and then to
 * a state machine by @babel/runtime's regenerator helper (a single shared
 * module), rather than by the pure-mode plugin which duplicates the import in
 * every file that awaits.
 */
import { createRequire } from 'module';

// transform-runtime emits imports for the helpers this runtime version has.
const runtimeVersion = createRequire(import.meta.url)('@babel/runtime/package.json').version;

/** @type {import('@babel/core').ConfigFunction} */
function makeConfig(api) {
  api.cache(true);

  return {
    // https://babel.dev/docs/assumptions
    assumptions: {
      noNewArrows: true
    },
    plugins: [
      '@babel/plugin-transform-typescript',
      // Dedupe Babel's helper functions into a shared runtime instead of
      // re-emitting them per module.
      ['@babel/plugin-transform-runtime', { version: runtimeVersion }]
    ],
    presets: [
      [
        '@babel/preset-env',
        {
          // webOS 3 runs Chromium 38; chrome 38 lowers everything to ES5.
          // Babel 7 did that without targets, Babel 8 would take browserslist
          // defaults instead (the suite's bundle-check is what catches that).
          targets: process.env.BROWSERSLIST || 'chrome 38',
          // Chromium 38 has Symbol, so its own typeof answers 'symbol'; the
          // transform would route every typeof on the hot paths through a helper.
          exclude: ['transform-typeof-symbol']
        }
      ]
    ]
  };
}

export default makeConfig;
