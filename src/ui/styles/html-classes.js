// The state of the UI as classes on <html>: Pure Black UI, the UI tweaks and
// the Aura look, each driven by a setting. The stylesheets (styles/theme-aura.css,
// the panel, the toasts, the clock's watch.css, yt-fixes.css) select on these
// classes, so a change of setting is one class toggle and no element is touched.
//
// On documentElement rather than body: YouTube's leanback app rewrites
// body.className on tab navigation and panel dialogs and would wipe a body
// class.
import { configRead, configAddChangeListener } from '../../core/config.js';
import { debounce } from '../../core/dom.js';
import './global.css';
import './theme-aura.css';

// The class, the settings it follows, and whether it is on.
const HTML_CLASSES = [
  { cls: 'ytaf-aura', keys: [], on: () => true },
  { cls: 'ytaf-fix-titles', keys: ['fixMultilineTitles'], on: (c) => !!c.fixMultilineTitles },
  { cls: 'ytaf-fix-search-font', keys: ['fixSearchFont'], on: (c) => !!c.fixSearchFont },
  { cls: 'ytaf-remove-borders', keys: ['removeBlackBorders'], on: (c) => !!c.removeBlackBorders },
  { cls: 'ytaf-oled', keys: ['enableOledCareMode'], on: (c) => !!c.enableOledCareMode },
  {
    cls: 'ytaf-oled-transparent-shelf',
    keys: ['enableOledCareMode', 'videoShelfOpacity'],
    on: (c) => !!c.enableOledCareMode && c.videoShelfOpacity > 50
  }
];

/** The current values of `keys`, as an object. */
const read = (keys) => {
  const values = {};
  for (let i = 0; i < keys.length; i++) values[keys[i]] = configRead(keys[i]);
  return values;
};

/**
 * The shelf backdrop's opacity, written as a rule of its own rather than a
 * custom property: Chromium 38 (webOS 3) has no var(). Written only while
 * Pure Black UI is on: the rule selects on html.ytaf-oled, so without the mode
 * it would be a stylesheet for nothing.
 */
function syncOledShelfOpacity() {
  if (!configRead('enableOledCareMode')) return;
  let style = document.getElementById('ytaf-oled-opacity');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ytaf-oled-opacity';
    document.head.appendChild(style);
  }
  // Whole per cent: the setting steps in 5s, and the shorter string is what
  // the style recalc parses.
  const opacity = (configRead('videoShelfOpacity') / 100).toFixed(2);
  style.textContent =
    'html.ytaf-oled .Jx9xPc { background-color: rgba(0, 0, 0, ' + opacity + ') !important; }';
}

/**
 * Sets every class of HTML_CLASSES on <html> from its settings and keeps it in step, and writes the
 * shelf opacity rule.
 */
export function initHtmlClasses() {
  const root = document.documentElement;
  for (let i = 0; i < HTML_CLASSES.length; i++) {
    const entry = HTML_CLASSES[i];
    let last = null;
    // `last` short-circuits a setting that did not change the class: the
    // shelf opacity steps send two listeners here per key press, and a
    // classList.toggle on an unchanged class is still a style invalidation
    // check on Chromium 38.
    const sync = () => {
      const on = entry.on(read(entry.keys));
      if (on !== last) {
        last = on;
        root.classList.toggle(entry.cls, on);
      }
    };
    sync();
    for (let k = 0; k < entry.keys.length; k++) configAddChangeListener(entry.keys[k], sync);
  }
  syncOledShelfOpacity();
  configAddChangeListener('enableOledCareMode', syncOledShelfOpacity);
  // The opacity row steps in 5 % increments: a held key is one rewrite of the
  // rule (a style recalc), not one per step.
  configAddChangeListener('videoShelfOpacity', debounce(syncOledShelfOpacity, 150));
}
