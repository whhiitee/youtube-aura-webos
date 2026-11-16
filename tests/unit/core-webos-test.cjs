/**
 * core/webos.js as a unit in a vm sandbox: the version this build reads from
 * the user agent, which the features use to decide what this TV needs (the
 * buffer limit and the emoji fix are webOS 3 and 4 code), and the simulator
 * branch the development pages take.
 *
 * YouTube Aura targets one device, the LG OLED55B7V (webOS 3.x, Chromium 38),
 * so the cases here are: the target itself, the same platform in the simulator,
 * a newer TV running the same bundle (the code still has to know what it is on),
 * and the fallbacks for a user agent that matches nothing.
 *
 * Run: node tests/unit/core-webos-test.cjs
 */
const { createReport } = require('../harness/report.cjs');
const { loadSources } = require('../harness/sandbox.cjs');
const { CORE, loggerStub } = require('../harness/stubs.cjs');

const report = createReport();
const t = report.check;

(async () => {
  // ---- core/webos.js ---------------------------------------------------------------
  {
    const detect = (userAgent, extra) => {
      const { createLogger, lines } = loggerStub();
      const { sandbox, get } = loadSources(
        [CORE('webos.js')],
        Object.assign({ createLogger, window: { navigator: { userAgent } } }, extra)
      );
      return { sb: sandbox, get, lines };
    };
    const base = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) ';

    // The target device's own user agent (firmware 06.10.65, M16P_DVB_EU).
    let r = detect(base + 'Chrome/38.0.2125.122 Safari/537.36 WebAppManager webOS.TV-2017');
    t(
      'the OLED55B7V (webOS.TV-2017) is webOS 3, on the legacy path, not a simulator',
      r.sb.getWebOSVersion() === 3 && r.sb.isLegacyWebOS() && r.get('simulatorMode') === false,
      String(r.sb.getWebOSVersion())
    );
    t(
      'the platform-year branch logs the year it matched',
      r.lines.info.some((l) => l === '[WebOS] Detected webOS 3 via platform year: 2017'),
      r.lines.info.join(' | ')
    );

    r = detect(base + 'Chrome/38.0.2125.122 Safari/537.36 WebAppManager webOS.TV-2016');
    t(
      'webOS.TV-2016 is webOS 3 too (the same engine)',
      r.sb.getWebOSVersion() === 3 && r.sb.isLegacyWebOS(),
      String(r.sb.getWebOSVersion())
    );

    // A newer set running the same bundle: the features branch on the number.
    r = detect(base + 'Chrome/79.0.3945.79 Safari/537.36 WebAppManager webOS.TV-2021');
    t(
      'webOS.TV-2021 is webOS 6: known, but past the webOS 3/4 code paths',
      r.sb.getWebOSVersion() === 6 && r.sb.isLegacyWebOS(),
      String(r.sb.getWebOSVersion())
    );
    r = detect(base + 'Chrome/94.0.4606.31 Safari/537.36 WebAppManager webOS.TV-2023');
    t(
      'webOS.TV-2023 is webOS 23: not the target, and not on the legacy path',
      r.sb.getWebOSVersion() === 23 && !r.sb.isLegacyWebOS(),
      String(r.sb.getWebOSVersion())
    );

    r = detect(base + 'Safari/537.36 WebAppManager _TV_O18/32.99.1');
    t(
      '_TV_O18 firmware below 33 and no Chrome token: the default 6, with a warning',
      r.sb.getWebOSVersion() === 6 &&
        r.lines.warn.some((l) => /Could not detect webOS version/.test(l)),
      r.lines.warn.join(' | ')
    );

    // The simulators: a desktop Chrome with no platform token at all.
    r = detect(base + 'Chrome/38.0.2125.122 Safari/537.36');
    t(
      'Chrome 38 alone is the webOS 3 simulator',
      r.sb.getWebOSVersion() === 3 && r.get('simulatorMode') === true
    );
    r = detect(base + 'Chrome/53.0.2785.143 Safari/537.36');
    t(
      'Chrome 53 alone is the webOS 4 simulator',
      r.sb.getWebOSVersion() === 4 && r.get('simulatorMode') === true
    );
    r = detect(base + 'Chrome/79.0.3945.79 Safari/537.36');
    t(
      'Chrome 79 alone is the webOS 6 simulator',
      r.sb.getWebOSVersion() === 6 && r.get('simulatorMode') === true && r.sb.isLegacyWebOS()
    );
    r = detect(base + 'Chrome/94.0.4606.31 Safari/537.36');
    t(
      'Chrome 87 and newer alone is a modern simulator: not legacy',
      r.sb.getWebOSVersion() === 22 && r.get('simulatorMode') === true && !r.sb.isLegacyWebOS()
    );

    const nav = { userAgent: 'Mozilla/5.0 (Unknown)' };
    const { createLogger, lines } = loggerStub();
    const { sandbox } = loadSources([CORE('webos.js')], {
      createLogger,
      window: { navigator: nav }
    });
    t(
      'no token at all: 6, with the warning, and simulatorMode stays off',
      sandbox.getWebOSVersion() === 6 && lines.warn.length === 1
    );
    nav.userAgent = base + 'Chrome/38.0.2125.122 Safari/537.36 WebAppManager webOS.TV-2017';
    t(
      'the version is cached: a changed user agent is not read again',
      sandbox.getWebOSVersion() === 6 && lines.warn.length === 1
    );

    t(
      'HAS_ABORT_CONTROLLER follows the global',
      detect('x').get('HAS_ABORT_CONTROLLER') === false &&
        detect('x', { AbortController }).get('HAS_ABORT_CONTROLLER') === true
    );
  }

  report.finish();
})();
