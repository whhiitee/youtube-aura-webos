// The options panel: the container and its tab menu, showing and hiding it
// and keeping focus inside it.
import './panel.css';
import { isWatchPage, isShortsPage } from '../../core/page-state.js';
import popup from '../../features/sponsorblock/popup.js';
import auraMarkUrl from '../icons/aura-mark.png';
import { createElement } from '../dom.js';
import {
  buildMainPage,
  buildSponsorPage,
  buildDeArrowPage,
  buildShortcutsPage,
  buildUITweaksPage
} from './pages.js';
import { createPanelKeyboard, pageFocusables } from './keyboard.js';
import { createFocusTrap } from './focus-trap.js';
import { createLogger } from '../../core/log.js';
import { ensureMenuKey } from '../shortcuts/bindings.js';
import { VERSION_LABEL } from '../../core/version.js';

const log = createLogger('Panel');

// The tabs in order: the page builder, and whether the SponsorBlock segment
// popup belongs next to the page while a video is open. A tab picked from
// inside a page puts focus on the page's first control (pageFocusables).
const PAGES = [
  { name: 'Main', build: buildMainPage },
  { name: 'SponsorBlock', build: buildSponsorPage, hasPopup: true },
  { name: 'DeArrow', build: buildDeArrowPage },
  { name: 'Shortcuts', build: buildShortcutsPage },
  { name: 'UI Tweaks', build: buildUITweaksPage }
];

/**
 * The pages, built lazily into `container`: `elements[i]` is page i once
 * built, `ensure(i)` builds it now, `startDeferred()` builds the rest one
 * per animation frame. A builder never runs twice.
 */
function createDeferredBuilder(pages, container) {
  const elements = [];
  const pending = pages.map((page) => page.build);

  /** Builds page `index` now, if it is not built yet, and adds it to the panel. */
  const ensure = (index) => {
    const build = pending[index];
    if (!build) return;
    pending[index] = null; // clear first: a builder must never run twice
    elements[index] = build();
    container.appendChild(elements[index]);
  };
  /**
   * Builds the pages not built yet, one per animation frame, so opening the panel does not wait for
   * all of them.
   */
  const startDeferred = () => {
    let index = 1;

    /** Builds the next unbuilt page and asks for another frame. */
    const step = () => {
      while (index < pages.length && !pending[index]) index++;
      if (index >= pages.length) return;
      ensure(index++);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  return { elements, ensure, startDeferred };
}

/**
 * The tab bar: a button per page, the first one active; `onPick(index)` on a
 * click, and the pointer leaving the bar puts focus back on the open tab
 * (`activeIndex()`). Returns the bar and its buttons.
 */
function createTabMenu(pages, onPick, activeIndex) {
  const buttons = pages.map((page, index) =>
    createElement('button', {
      class: index === 0 ? 'ytaf-tab-btn ytaf-active' : 'ytaf-tab-btn',
      text: page.name,
      events: {
        click: () => onPick(index),
        mouseenter: (e) => e.target.focus()
      }
    })
  );
  const element = createElement(
    'div',
    {
      class: 'ytaf-tab-menu',
      events: {
        mouseleave: () => {
          const active = document.activeElement;
          if (active && active.classList.contains('ytaf-tab-btn')) buttons[activeIndex()].focus();
        }
      }
    },
    ...buttons
  );
  return { element, buttons };
}

// Built on the first open, or ahead of time by the idle prewarm below: the
// container element plus the hooks showOptionsPanel() drives after a build.
let panel = null;
let optionsPanelVisible = false;
let panelInitBlock = false;
// The prewarm ran or was cancelled: it runs once per session.
let prewarmDone = false;

// How long after load the prewarm waits. The TV is still busy with YouTube's
// own first paint before then, and the settings are not needed that early.
const PREWARM_DELAY_MS = 3500;

/** Whether the options panel is currently shown. */
export function isOptionsPanelVisible() {
  return optionsPanelVisible;
}

/** Builds the panel (the Main page included) and puts it in the page, hidden. */
function buildPanel() {
  log.debug('building the panel (lazy)');
  panel = createOptionsPanel();
  document.body.appendChild(panel.element);
  return panel;
}

/**
 * Builds the panel while the TV is idle, so the first press of the menu key
 * shows it instead of building it.
 *
 * The build was measured at up to 170 ms of one frozen keydown on webOS 3
 * (tests/bench/panel-bench.cjs), all of it element creation and the style and
 * layout work behind it. Moving it here costs the same work in a frame nobody
 * is waiting on, and the remote's first press is then one display:block.
 *
 * Only the panel shell and the Main page are built: the four pages after it
 * keep building one per frame once the panel is on screen, and building them
 * here would hold ~200 more elements in memory for a tab the user may never
 * open. Nothing is built while a video is playing: decode owns the CPU there.
 */
function schedulePrewarm() {
  if (prewarmDone) return;
  prewarmDone = true;

  /** Builds the panel now if it is still worth doing. */
  const warm = () => {
    if (panel || optionsPanelVisible || isWatchPage() || isShortsPage()) return;
    buildPanel();
  };
  const timer = setTimeout(() => {
    // requestIdleCallback, where the engine has it (Chromium 51+): the build
    // yields to whatever the page is doing. webOS 3 has none.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warm, { timeout: 2000 });
    } else {
      warm();
    }
  }, PREWARM_DELAY_MS);
  // Leaving before it fires: nothing to warm.
  window.addEventListener('pagehide', () => clearTimeout(timer));
}

if (typeof document !== 'undefined') {
  schedulePrewarm();
}

// The heading: the Aura mark, the wordmark and the version. Static apart from
// the version text, and built once (the first open).
function createHeading() {
  return createElement(
    'h1',
    {},
    createElement('img', {
      src: auraMarkUrl,
      alt: '',
      class: 'ytaf-logo',
      // No focus, no pointer: the mark is decoration, not a control.
      draggable: false
    }),
    createElement('span', { text: 'YouTube Aura' }),
    // "1.0.0", or "1.0.0 b2" on a test build (core/version.js). A + rather
    // than a template: the legacy build's ES5 turns a template into a
    // concat() call, which the minifier does not fold into one string.
    createElement('span', { class: 'ytaf-version', text: VERSION_LABEL })
  );
}

/**
 * Builds the options panel: heading, tab bar, the Main page (the others are built later), the
 * keyboard handler and the focus trap. Returns the element and its controls.
 */
function createOptionsPanel() {
  const elContainer = createElement('div', {
    class: 'ytaf-ui-container',
    style: { display: 'none' }
  });

  let activePage = 0;
  const pages = createDeferredBuilder(PAGES, elContainer);
  const pageEls = pages.elements;

  /**
   * Shows the SponsorBlock segment popup beside the panel while its page is open on a watch page.
   */
  const syncPopup = () => popup.togglePopup(!!PAGES[activePage].hasPopup && isWatchPage());

  /**
   * Shows page `pageIndex` (building it first if needed), marks its tab, and moves the focus into
   * it unless the user is on the tab bar.
   */
  const setActivePage = (pageIndex) => {
    if (pageIndex === activePage) return;
    pages.ensure(pageIndex); // may still be queued behind the rAF build chain

    pageEls[activePage].style.display = 'none';
    tabBtns[activePage].classList.remove('ytaf-active');
    activePage = pageIndex;
    pageEls[activePage].style.display = 'block';
    tabBtns[activePage].classList.add('ytaf-active');

    // Focus follows the page unless the user is walking the tab bar.
    const activeEl = document.activeElement;
    if (!(activeEl && activeEl.classList.contains('ytaf-tab-btn'))) {
      const first = pageFocusables(pageEls[activePage])[0];
      if (first) first.focus();
    }

    syncPopup();
  };
  const tabMenu = createTabMenu(PAGES, setActivePage, () => activePage);
  const tabBtns = tabMenu.buttons;

  const keyboard = createPanelKeyboard(elContainer, {
    tabBtns,
    get activePage() {
      return activePage;
    },
    pages: () => pageEls,
    close: () => showOptionsPanel(false)
  });

  const elHeading = createHeading();
  elContainer.appendChild(elHeading);
  elContainer.appendChild(tabMenu.element);

  // Only the Main page is built up front: building all four inside the keydown
  // handler cost 170 ms on webOS 3, three quarters of it on display:none pages.
  // The rest build one per animation frame once the panel is on screen, and
  // setActivePage() forces a synchronous build if the user beats the chain.
  pages.ensure(0);

  const focusTrap = createFocusTrap({
    container: elContainer,
    allowed: (target) => !!(target.closest && target.closest('.sb-segments-popup')),
    firstControl: () => tabBtns[activePage]
  });

  return {
    element: elContainer,
    /** The tab button of the open page. */
    activeTab: () => tabBtns[activePage],
    buildDeferredPages: pages.startDeferred,
    syncPopup,
    focusTrap,
    keyboard
  };
}

/**
 * Opens (building it the first time, if the idle prewarm has not) or closes the options panel, with
 * its keyboard handler, focus trap and popup.
 */
export function showOptionsPanel(visible) {
  if (panelInitBlock) {
    log.debug('toggle blocked during initialization');
    return;
  }
  if (visible && !optionsPanelVisible) {
    if (!panel) {
      // The prewarm was skipped or has not run yet. The build is the slow path
      // (see schedulePrewarm): a menu key held or repeated through it is
      // delivered right after and would toggle the panel straight back shut, so
      // toggles are ignored for half a second.
      panelInitBlock = true;
      setTimeout(() => {
        panelInitBlock = false;
      }, 500);
      buildPanel();
    }

    log.debug('shown');
    panel.element.style.display = 'block';
    panel.buildDeferredPages();
    panel.syncPopup();

    const activeTab = panel.activeTab();
    activeTab.focus();
    panel.focusTrap.attach(activeTab);
    panel.keyboard.attach();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible && panel) {
    log.debug('hidden');
    panel.focusTrap.detach();
    panel.keyboard.detach();
    // Focus leaves the hidden control at once, not when the engine gets to it,
    // the SponsorBlock popup's too (a Magic Remote click can put it there).
    const focused = document.activeElement;
    if (focused && (panel.element.contains(focused) || focused.closest('.sb-segments-popup'))) {
      focused.blur();
    }
    panel.element.style.display = 'none';
    popup.togglePopup(false);
    optionsPanelVisible = false;
    // A binding changed on the panel may have left no key that opens it.
    ensureMenuKey(true);
  }
}

// Test hooks: the behaviour tests open and close the panel through the
// first, and wait for the panel to take toggles again through the second.
window.ytaf_showOptionsPanel = showOptionsPanel;

/** Test hook: whether the panel takes toggles again (the first build's 500 ms block is over). */
window.ytaf_panelTakesToggles = () => !panelInitBlock;
