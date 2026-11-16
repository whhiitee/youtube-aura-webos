/**
 * The Aura look and Pure Black UI against the built bundle: the document
 * carries ytaf-aura always and ytaf-oled from the setting
 * (ui/styles/html-classes.js), the shelf opacity is written as a rule, the UI
 * tweaks set their <html> classes through the panel, and the oled_toggle
 * shortcut puts up and takes down the black overlay (no toast for it, the
 * deactivation has one), which the menu key ends, with its keep-alive presses
 * underneath.
 *
 * One theme is the point: the test also holds that no second theme class can
 * appear, so a fork that brings one back is caught here.
 *
 * Run: node tests/behaviour/theme-aura-test.cjs [bundle]
 */
const { createPage } = require('../harness/page.cjs');
const { createReport } = require('../harness/report.cjs');
const {
  wait,
  waitFor,
  KEYS,
  press,
  toasts,
  panelCheckbox,
  cycleRow,
  showPanel
} = require('../harness/fixtures.cjs');

const report = createReport();
const t = report.check;

function boot(cfg, more) {
  const page = createPage(Object.assign({ config: Object.assign({ showWatch: true }, cfg) }, more));
  const win = page.win;
  const d = win.document;
  return {
    win,
    d,
    press: (code, target) => press(win, code, target || d.body),
    toasts: () => toasts(win),
    panel: () => d.querySelector('.ytaf-ui-container'),
    html: () => d.documentElement.classList,
    pump: page.pump
  };
}

(async () => {
  // ---- the Aura look ---------------------------------------------------------
  {
    const { d, panel, html, pump, win } = boot({});
    t('the document carries the Aura class', html().contains('ytaf-aura'));
    t(
      'and only one theme class: no other theme can come back',
      Array.from(html()).filter((c) => /^ytaf-theme-/.test(c)).length === 0,
      Array.from(html()).join(' ')
    );
    // Pure Black UI is on for a fresh install: this is an OLED-first build.
    t('Pure Black UI is on by default', html().contains('ytaf-oled'));
    t(
      'on by default, the shelf backdrop is transparent (opacity 100)',
      html().contains('ytaf-oled-transparent-shelf')
    );
    await showPanel(win, pump);
    t(
      'the panel has one mark and no per-theme logos',
      !!panel() &&
        panel().querySelectorAll('.ytaf-logo').length === 1 &&
        !panel().querySelector('.ytaf-logo-red')
    );
    t(
      'the heading carries the version separately',
      !!panel().querySelector('.ytaf-version') &&
        /^\d+\.\d+\.\d+/.test(panel().querySelector('.ytaf-version').textContent),
      panel().querySelector('.ytaf-version') && panel().querySelector('.ytaf-version').textContent
    );
    t('the stylesheet reaches the page', d.querySelectorAll('style').length > 0);
  }

  // ---- Pure Black UI ---------------------------------------------------------
  {
    const {
      d,
      html,
      pump,
      win,
      press: pressKey
    } = boot({
      enableOledCareMode: true,
      videoShelfOpacity: 70
    });
    t('Pure Black UI: the document is marked for the stylesheets', html().contains('ytaf-oled'));
    const opacityRule = d.getElementById('ytaf-oled-opacity');
    t(
      'the shelf opacity is written as a rule, and above 50 % the transparent class is on',
      !!opacityRule &&
        opacityRule.textContent.indexOf('.Jx9xPc { background-color: rgba(0, 0, 0, 0.70)') !== -1 &&
        html().contains('ytaf-oled-transparent-shelf'),
      opacityRule && opacityRule.textContent
    );
    t('the clock is on the page', !!d.querySelector('.ytaf-watch'));
    // The Pure Black checkbox on the Main page turns the mode off and on again.
    await showPanel(win, pump);
    const oledBox = panelCheckbox(win, 'Pure Black UI (OLED)');
    t(
      'setup: the Pure Black checkbox is on the Main page and checked',
      !!oledBox && oledBox.checked
    );
    oledBox.click();
    t(
      'off: the OLED classes are gone',
      !html().contains('ytaf-oled') && !html().contains('ytaf-oled-transparent-shelf')
    );
    oledBox.click();
    t(
      'on again: both classes are back',
      html().contains('ytaf-oled') && html().contains('ytaf-oled-transparent-shelf')
    );

    // The opacity row: a burst of steps is one rewrite of the rule, after 150 ms.
    d.querySelectorAll('.ytaf-tab-btn')[4].click();
    const row = cycleRow(win, 'Video shelf opacity', '#ytaf-page-ui-tweaks');
    t('setup: the opacity row is on the UI tweaks page', !!row);
    row.focus();
    const ruleText = () => d.getElementById('ytaf-oled-opacity').textContent;
    pressKey(KEYS.LEFT, row);
    pressKey(KEYS.LEFT, row);
    t('two quick steps leave the rule as it was', ruleText().indexOf('0.70)') !== -1, ruleText());
    await wait(250);
    t(
      'after the debounce the rule carries the new value',
      ruleText().indexOf('0.60)') !== -1,
      ruleText()
    );
  }

  // ---- the OLED overlay shortcut --------------------------------------------------
  {
    // The panel takes no toggle for 500 ms after a build: 50 ms at a tenth.
    const { d, press, toasts, panel, pump, win } = boot({}, { timers: { scale: 10, from: 500 } });
    press(KEYS.RED);
    await wait(50);
    t('red: the black overlay is on the page', !!d.getElementById('ytaf-oled-overlay'));
    // The welcome toast (2 s, here 200 ms) may come meanwhile on a loaded machine.
    const own = toasts().filter((m) => !/to open the settings/.test(m));
    t('red: no toast, which the overlay would cover anyway', own.length === 0, own.join(' | '));
    await wait(150); // past the repeated-key debounce
    press(KEYS.RED);
    await wait(50);
    t('red again: the overlay is gone', !d.getElementById('ytaf-oled-overlay'));
    t(
      'red again: the toast says the mode is off',
      toasts().some((m) => m === 'OLED Mode Deactivated'),
      toasts().join(' | ')
    );

    // Opening the panel over the overlay ends the overlay: it would cover the panel.
    await wait(150);
    press(KEYS.RED);
    await wait(50);
    t('setup: the overlay is up again', !!d.getElementById('ytaf-oled-overlay'));
    await wait(150);
    press(KEYS.GREEN);
    pump();
    await wait(50);
    t(
      'the menu key opens the panel and takes the overlay down',
      panel() && panel().style.display === 'block' && !d.getElementById('ytaf-oled-overlay'),
      toasts().join(' | ')
    );
    // Past the toggle guard of the build the menu key started.
    await wait(60);
    win.ytaf_showOptionsPanel(false);
    pump();
    t('setup: the panel closed', panel().style.display !== 'block', panel().style.display);
    await wait(60);

    // While the options panel is open, the shortcuts are the panel's, not the overlay's.
    await showPanel(win, pump);
    t('setup: the panel is open', panel() && panel().style.display === 'block');
    await wait(150);
    press(KEYS.RED);
    await wait(50);
    t(
      'with the panel open the red key does not toggle the overlay',
      !d.getElementById('ytaf-oled-overlay')
    );
  }

  // ---- the UI tweaks as <html> classes, through the panel ---------------------------
  {
    const { html, pump, win } = boot({ fixMultilineTitles: true, removeBlackBorders: true });
    t(
      'fix titles and the liquid glass UI on: both classes are on the document',
      html().contains('ytaf-fix-titles') && html().contains('ytaf-remove-borders')
    );
    await showPanel(win, pump);
    const titles = panelCheckbox(win, 'Fix Multiline Titles');
    const glass = panelCheckbox(win, 'New Liquid Glass UI');
    t(
      'setup: both checkboxes are on the panel and checked',
      !!titles && titles.checked && !!glass && glass.checked
    );
    titles.click();
    glass.click();
    t(
      'unchecked: both classes leave the document at once',
      !html().contains('ytaf-fix-titles') && !html().contains('ytaf-remove-borders')
    );
    titles.click();
    t(
      'checked again: the class is back and the other stays off',
      html().contains('ytaf-fix-titles') && !html().contains('ytaf-remove-borders')
    );
  }

  // ---- Fix Search Results Font: the search page's titles in the TV's font -------------
  {
    const { html, pump, win } = boot({});
    const d = win.document;
    t('on by default: its class is on the document', html().contains('ytaf-fix-search-font'));
    const title = d.createElement('div');
    title.className = 'prqC5c';
    title.style.fontFamily = 'Roboto, sans-serif';
    d.body.appendChild(title);
    await wait(50);
    const font = () => win.getComputedStyle(title).fontFamily;
    t('off the search page YouTube keeps its own font', /^Roboto/.test(font()), font());
    d.body.classList.add('WEB_PAGE_TYPE_SEARCH');
    t(
      'on the search page the titles take LG Display',
      /^"?LG Display-Regular/.test(font()),
      font()
    );
    await showPanel(win, pump);
    const box = panelCheckbox(win, 'Fix Search Results Font');
    t('setup: its checkbox is on the panel and checked', !!box && box.checked);
    box.click();
    t(
      'unchecked: the class leaves and the search page keeps Roboto',
      !html().contains('ytaf-fix-search-font') && /^Roboto/.test(font()),
      font()
    );
  }

  // ---- the overlay's keep-alive ---------------------------------------------------
  {
    // The 30 min keep-alive at a ten-thousandth: 180 ms; the second press of
    // each pair, 250 ms after the first, comes at once here.
    const page = createPage({
      config: { showWatch: true },
      captureKeys: true,
      timers: { scale: 10000, from: 250 }
    });
    const { win, keys } = page;
    const d = win.document;
    const ups = () => keys.filter((k) => k === KEYS.UP).length;
    press(win, KEYS.RED, d.body);
    t('setup: the overlay is up', !!d.getElementById('ytaf-oled-overlay'));
    await wait(60);
    t('nothing is pressed before the first keep-alive', ups() === 0, keys.join(','));
    await waitFor(() => ups() >= 2);
    t(
      'under the overlay an UP and a second one 250 ms later keep the TV awake',
      ups() === 2,
      keys.join(',')
    );
    press(win, KEYS.RED, d.body);
    t('setup: the overlay is down', !d.getElementById('ytaf-oled-overlay'));
    const sent = ups();
    await wait(400);
    t('with the overlay down the keep-alive stops', ups() === sent, keys.join(','));
  }

  report.finish();
})();
