# Code map: dev/

Part of the [code map](../CODEMAP.md), generated from the source by `tools/codemap.mjs`: do not edit it by hand.

Modules: [dev/perf-mon.js](#mod-perf-mon-js)

<a id="mod-perf-mon-js"></a>

## dev/perf-mon.js

> perf-mon.js — YTAF Engine Diagnostics ===================================================================== Dev-only instrumentation for the webOS YouTube mod.
>
> WHAT IT DOES 1. Hooks every runtime boundary this mod actually crosses (JSON.parse, JSON.stringify, fetch, XHR, MutationObserver, IntersectionObserver, timers, rAF, DOM queries, layout reads, event listeners) and charges the cost back to the module + function responsible. 2. Carries a registry of every function in the codebase and its role, so the cluster reports "this is firing / this is silent / this should not be running here" instead of anonymous numbers. 3. Runs a feature-expectation sweep on every page transition: for each enabled option it knows what should happen on this page, and verifies it against live DOM and runtime evidence. 4. Renders an automotive instrument cluster sized for a TV across a room. 5. Emits machine-readable bottleneck reports for an AI agent to review.
>
> LOAD ORDER MATTERS. Import this first in userScript.js (after the polyfills). It installs "inner" probes immediately, so it sits underneath adblock's JSON.parse hook and can time the native parse; then it arms "outer" probes in a deferred task once the bundle has finished evaluating, so it also sits above every mod hook and can time the total. Mod overhead = outer - inner.
>
> REMOTE   Press 0 three times within 1.5s to toggle the cluster. LEFT/RIGHT tab. UP/DOWN scroll. OK emits a report. BACK closes. (YELLOW is NOT used: YouTube's own leanback UI claims it, and screensaver-fix.js synthesises a YELLOW press every 30s on Shorts.) CONSOLE  __PERF.help(), __PERF.toggle()

4740 lines · imported by [userScript.js](app.md#mod-userscript-js)

**At load:**

- **Calls:** [Meter](#fn-perf-mon-js-meter), [Counter](#fn-perf-mon-js-counter), [fmtMs](#fn-perf-mon-js-fmtms), [chan](#fn-perf-mon-js-chan), [chanRate](#fn-perf-mon-js-chanrate), [countUpgradedThumbs](#fn-perf-mon-js-countupgradedthumbs), [observersFrom](#fn-perf-mon-js-observersfrom), [qa](#fn-perf-mon-js-qa), [byId](#fn-perf-mon-js-byid), [ensureVideoTickProbe](#fn-perf-mon-js-ensurevideotickprobe), [fnStats](#fn-perf-mon-js-fnstats), [hasClass](#fn-perf-mon-js-hasclass), [parseTypeSeen](#fn-perf-mon-js-parsetypeseen), [anyFnRan](#fn-perf-mon-js-anyfnran), [q](#fn-perf-mon-js-q), [cfgGet](#fn-perf-mon-js-cfgget), [playerVideo](#fn-perf-mon-js-playervideo), [topFunctions](#fn-perf-mon-js-topfunctions), [installInnerJsonProbe](#fn-perf-mon-js-installinnerjsonprobe), [installObserverProbes](#fn-perf-mon-js-installobserverprobes), [installTimerProbes](#fn-perf-mon-js-installtimerprobes), [installDomProbes](#fn-perf-mon-js-installdomprobes), [installEventProbes](#fn-perf-mon-js-installeventprobes), [installNetworkProbes](#fn-perf-mon-js-installnetworkprobes), [armOuter](#fn-perf-mon-js-armouter)
- **Settings:** uses `enableAdBlock`, `enableTrackingBlock`, `upgradeThumbnails`, `enableSponsorBlock`, `enableReturnYouTubeDislike`, `forceHighResVideo`, `enableLegacyEmojiFix`, `removeGlobalShorts`, `removeTopLiveGames`, `removeMostRelevant`, `hideGuestSignInPrompts`, `hideEndcards`, `enableAutoLogin`, `showWatch`, `enableOledCareMode`, `logoStyle`, `fixMultilineTitles`, `removeBlackBorders`, `disableNotifications`, `forcePreviews`
- **Hooks:** `window.__PERF`

- <a id="fn-perf-mon-js-safe"></a>`safe(fn, label)` · L140–152 · Instrumentation must never take the app down.
- <a id="fn-perf-mon-js-meter"></a>`Meter(name)` · L159–169 · Windowed meter: cumulative totals plus a ring of recent samples, so we can answer "how many ms of blocking work in the last second" — the only figure that correlates with dropped frames.
- <a id="fn-perf-mon-js-meter-prototype-add"></a>`Meter.prototype.add(v)` · L170–179
- <a id="fn-perf-mon-js-meter-prototype-window"></a>`Meter.prototype.window(w)` · L180–191
- <a id="fn-perf-mon-js-meter-prototype-avg"></a>`Meter.prototype.avg()` · L192–194
- <a id="fn-perf-mon-js-counter"></a>`Counter()` · L197–202 · Rate counter for events with no duration.
- <a id="fn-perf-mon-js-counter-prototype-hit"></a>`Counter.prototype.hit(n)` · L203–208
- <a id="fn-perf-mon-js-counter-prototype-rate"></a>`Counter.prototype.rate(w)` · L209–215
- <a id="fn-perf-mon-js-fmtms"></a>`fmtMs(v)` · L217–223
- <a id="fn-perf-mon-js-clamp"></a>`clamp(v, lo, hi)` · L224–228
- <a id="fn-perf-mon-js-trunc"></a>`trunc(s, n)` · L229–232
- <a id="fn-perf-mon-js-modulefromsource"></a>`moduleFromSource(fn)` · L308–320
- <a id="fn-perf-mon-js-capturestack"></a>`captureStack()` · L560–570
- <a id="fn-perf-mon-js-modulefromstack"></a>`moduleFromStack(stack)` · L572–583
- <a id="fn-perf-mon-js-isourcode"></a>`isOurCode(stack)` · L585–590
- <a id="fn-perf-mon-js-originof"></a>`originOf(fn, hint)` · L595–638 · Resolve and memoise {module, fn, role, cost, ours} for a callback.
- <a id="fn-perf-mon-js-unknownorigin"></a>`unknownOrigin(hint)` · L640–651
- <a id="fn-perf-mon-js-ledgerfor"></a>`ledgerFor(origin)` · L664–675
- <a id="fn-perf-mon-js-modulemeter"></a>`moduleMeter(mod)` · L677–681
- <a id="fn-perf-mon-js-currentcontext"></a>`currentContext()` · L683–685
- <a id="fn-perf-mon-js-charge"></a>`charge(origin, fn, thisArg, args)` · L688–703 · Run fn under an attribution context and charge its inclusive wall time.
- <a id="fn-perf-mon-js-topfunctions"></a>`topFunctions(limit, windowMs)` · L705–729
- <a id="fn-perf-mon-js-channel"></a>`channel(name)` · L796–809
- <a id="fn-perf-mon-js-detectpage"></a>`detectPage()` · L818–829
- <a id="fn-perf-mon-js-onpagechange"></a>`onPageChange(fn)` · L832–834
- <a id="fn-perf-mon-js-checkpage"></a>`checkPage()` · L836–853
- <a id="fn-perf-mon-js-keepsample"></a>`keepSample(text)` · L872–879
- <a id="fn-perf-mon-js-synthorigin"></a>`synthOrigin(fnName, fallbackModule)` · L891–902
- <a id="fn-perf-mon-js-chargehook"></a>`chargeHook(origin, msSpent)` · L904–910
- <a id="fn-perf-mon-js-classifyresponse"></a>`classifyResponse(text)` · L912–924
- <a id="fn-perf-mon-js-typebucket"></a>`typeBucket(t)` · L926–938
- <a id="fn-perf-mon-js-installinnerjsonprobe"></a>`installInnerJsonProbe()` · L940–965
- <a id="fn-perf-mon-js-installinnerjsonprobe-innerparse"></a>`installInnerJsonProbe.innerParse(text, reviver)` · L943–952
- <a id="fn-perf-mon-js-installinnerjsonprobe-json-stringify"></a>`installInnerJsonProbe.JSON.stringify(value, replacer, space)` · L957–964
- <a id="fn-perf-mon-js-installouterjsonprobe"></a>`installOuterJsonProbe()` · L967–1050
- <a id="fn-perf-mon-js-installouterjsonprobe-outerparse"></a>`installOuterJsonProbe.outerParse(text, reviver)` · L985–1022
- <a id="fn-perf-mon-js-installouterjsonprobe-json-stringify"></a>`installOuterJsonProbe.JSON.stringify(value, replacer, space)` · L1027–1047
- <a id="fn-perf-mon-js-classifyurl"></a>`classifyUrl(url)` · L1067–1073
- <a id="fn-perf-mon-js-recordrequest"></a>`recordRequest(kind, method, url, ms, ok)` · L1075–1100
- <a id="fn-perf-mon-js-installnetworkprobes"></a>`installNetworkProbes()` · L1102–1222
- <a id="fn-perf-mon-js-installnetworkprobes-navigator-sendbeacon"></a>`installNetworkProbes.navigator.sendBeacon(url, _data)` · L1109–1123
- <a id="fn-perf-mon-js-installnetworkprobes-window-fetch"></a>`installNetworkProbes.window.fetch(resource, init)` · L1131–1168
- <a id="fn-perf-mon-js-installnetworkprobes-window-fetch-done"></a>`installNetworkProbes.window.fetch.done(ok)` · L1137–1142
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-open"></a>`installNetworkProbes.XHR.prototype.open(method, url)` · L1177–1185
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send"></a>`installNetworkProbes.XHR.prototype.send()` · L1187–1220
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send-finish"></a>`installNetworkProbes.XHR.prototype.send.finish()` · L1192–1200
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send-this-onreadystatechange"></a>`installNetworkProbes.XHR.prototype.send.this.onreadystatechange()` · L1205–1208
- <a id="fn-perf-mon-js-describetarget"></a>`describeTarget(target)` · L1234–1246
- <a id="fn-perf-mon-js-describeoptions"></a>`describeOptions(o)` · L1248–1258
- <a id="fn-perf-mon-js-registerobserver"></a>`registerObserver(rec)` · L1260–1264
- <a id="fn-perf-mon-js-installobserverprobes"></a>`installObserverProbes()` · L1266–1375
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo"></a>`installObserverProbes.PatchedMO(callback)` · L1272–1330
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-wrapped"></a>`installObserverProbes.PatchedMO.wrapped(records, observer)` · L1286–1306
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-inst-observe"></a>`installObserverProbes.PatchedMO.inst.observe(target, options)` · L1314–1323
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-inst-disconnect"></a>`installObserverProbes.PatchedMO.inst.disconnect()` · L1324–1327
- <a id="fn-perf-mon-js-installobserverprobes-patchedio"></a>`installObserverProbes.PatchedIO(callback, options)` · L1338–1371
- <a id="fn-perf-mon-js-installobserverprobes-patchedio-wrapped"></a>`installObserverProbes.PatchedIO.wrapped(entries, observer)` · L1351–1357
- <a id="fn-perf-mon-js-installobserverprobes-patchedio-inst-observe"></a>`installObserverProbes.PatchedIO.inst.observe(target)` · L1360–1368
- <a id="fn-perf-mon-js-installtimerprobes"></a>`installTimerProbes()` · L1381–1483
- <a id="fn-perf-mon-js-installtimerprobes-window-settimeout"></a>`installTimerProbes.window.setTimeout(fn, delay)` · L1388–1406
- <a id="fn-perf-mon-js-installtimerprobes-window-settimeout-wrapped"></a>`installTimerProbes.window.setTimeout.wrapped()` · L1397–1404
- <a id="fn-perf-mon-js-installtimerprobes-window-setinterval"></a>`installTimerProbes.window.setInterval(fn, delay)` · L1408–1439
- <a id="fn-perf-mon-js-installtimerprobes-window-setinterval-wrapped"></a>`installTimerProbes.window.setInterval.wrapped()` · L1424–1434
- <a id="fn-perf-mon-js-installtimerprobes-window-clearinterval"></a>`installTimerProbes.window.clearInterval(id)` · L1441–1444
- <a id="fn-perf-mon-js-installtimerprobes-window-requestanimationframe"></a>`installTimerProbes.window.requestAnimationFrame(fn)` · L1448–1481
- <a id="fn-perf-mon-js-installtimerprobes-window-requestanimationframe-wrapped"></a>`installTimerProbes.window.requestAnimationFrame.wrapped(ts)` · L1455–1479
- <a id="fn-perf-mon-js-installdomprobes"></a>`installDomProbes()` · L1492–1541
- <a id="fn-perf-mon-js-installdomprobes-wrapquery"></a>`installDomProbes.wrapQuery(proto, name, counter, meter)` · L1494–1507
- <a id="fn-perf-mon-js-installdomprobes-wrapquery-proto-name"></a>`installDomProbes.wrapQuery.proto[name](_sel)` · L1497–1506
- <a id="fn-perf-mon-js-installdomprobes-element-prototype-getboundingclientrect"></a>`installDomProbes.Element.prototype.getBoundingClientRect()` · L1528–1531
- <a id="fn-perf-mon-js-installdomprobes-window-getcomputedstyle"></a>`installDomProbes.window.getComputedStyle()` · L1535–1538
- <a id="fn-perf-mon-js-listenerkey"></a>`listenerKey(type, options)` · L1553–1556
- <a id="fn-perf-mon-js-installeventprobes"></a>`installEventProbes()` · L1558–1604
- <a id="fn-perf-mon-js-installeventprobes-et-prototype-addeventlistener"></a>`installEventProbes.ET.prototype.addEventListener(type, listener, options)` · L1566–1592
- <a id="fn-perf-mon-js-installeventprobes-et-prototype-removeeventlistener"></a>`installEventProbes.ET.prototype.removeEventListener(type, listener, options)` · L1594–1603
- <a id="fn-perf-mon-js-wrapprototype"></a>`wrapPrototype(obj, moduleName)` · L1630–1681
- <a id="fn-perf-mon-js-wrapprototype-wrapper"></a>`wrapPrototype.wrapper()` · L1661–1663
- <a id="fn-perf-mon-js-pollforprototypes"></a>`pollForPrototypes()` · L1683–1696
- <a id="fn-perf-mon-js-pollforprototypes-tick"></a>`pollForPrototypes.tick()` · L1685–1693
- <a id="fn-perf-mon-js-q"></a>`q(sel)` · L1708–1714
- <a id="fn-perf-mon-js-qa"></a>`qa(sel)` · L1715–1721
- <a id="fn-perf-mon-js-byid"></a>`byId(id)` · L1722–1728
- <a id="fn-perf-mon-js-hasclass"></a>`hasClass(cls)` · L1729–1731
- <a id="fn-perf-mon-js-cfg"></a>`cfg()` · L1778–1795
- <a id="fn-perf-mon-js-cfgget"></a>`cfgGet(key)` · L1797–1800
- <a id="fn-perf-mon-js-chan"></a>`chan(name)` · L1820–1822
- <a id="fn-perf-mon-js-chanrate"></a>`chanRate(name, w)` · L1823–1826
- <a id="fn-perf-mon-js-fnstats"></a>`fnStats(module, fn)` · L1827–1837
- <a id="fn-perf-mon-js-anyfnran"></a>`anyFnRan(module, fns)` · L1838–1844
- <a id="fn-perf-mon-js-isupgradedtile"></a>`isUpgradedTile(el)` · L1859–1865
- <a id="fn-perf-mon-js-countupgradedthumbs"></a>`countUpgradedThumbs()` · L1867–1885
- <a id="fn-perf-mon-js-playervideo"></a>`playerVideo()` · L1888–1890 · The one &lt;video> the mod cares about.
- <a id="fn-perf-mon-js-ensurevideotickprobe"></a>`ensureVideoTickProbe()` · L1899–1912
- <a id="fn-perf-mon-js-countdom"></a>`countDom()` · L1921–1949 · getElementsByTagName('\*') stops at a shadow boundary, and YouTube's ytlr-\* elements are custom elements that may hold their subtree in a shadow root.
- <a id="fn-perf-mon-js-observersfrom"></a>`observersFrom(moduleName)` · L1951–1958
- <a id="fn-perf-mon-js-parsetypeseen"></a>`parseTypeSeen(type, withinMs)` · L1959–1964
- <a id="fn-perf-mon-js-allfeatures"></a>`allFeatures()` · L2701–2703
- <a id="fn-perf-mon-js-featureenabled"></a>`featureEnabled(f)` · L2705–2710
- <a id="fn-perf-mon-js-evaluatefeature"></a>`evaluateFeature(f, page)` · L2716–2765 · Evaluate one feature against the current page.
- <a id="fn-perf-mon-js-evaluateall"></a>`evaluateAll(page)` · L2767–2773
- <a id="fn-perf-mon-js-evaluateallcached"></a>`evaluateAllCached(ttl)` · L2782–2789
- <a id="fn-perf-mon-js-dedupe"></a>`dedupe(list)` · L2798–2807
- <a id="fn-perf-mon-js-runsweep"></a>`runSweep(page, reason)` · L2809–2857
- <a id="fn-perf-mon-js-logsweep"></a>`logSweep(sweep)` · L2869–2933
- <a id="fn-perf-mon-js-findbottlenecks"></a>`findBottlenecks()` · L3229–3240
- <a id="fn-perf-mon-js-buildreport"></a>`buildReport()` · L3246–3425
- <a id="fn-perf-mon-js-coverage"></a>`coverage()` · L3427–3449
- <a id="fn-perf-mon-js-emitreport"></a>`emitReport(reason)` · L3454–3504
- <a id="fn-perf-mon-js-maybeemitreport"></a>`maybeEmitReport(reason)` · L3506–3521
- <a id="fn-perf-mon-js-installvitals"></a>`installVitals()` · L3527–3607
- <a id="fn-perf-mon-js-installvitals-loop"></a>`installVitals.loop()` · L3532–3544
- <a id="fn-perf-mon-js-el"></a>`el(tag, styles, text)` · L3642–3652 · All elements are created here so they can all carry the `twemoji-injected` marker: emoji-font.js treats that class as "already processed" and skips the subtree, which keeps the monitor out of the observer it is measur...
- <a id="fn-perf-mon-js-svg"></a>`svg(tag, attrs)` · L3654–3662
- <a id="fn-perf-mon-js-polar"></a>`polar(cx, cy, r, deg)` · L3667–3670
- <a id="fn-perf-mon-js-arcpath"></a>`arcPath(cx, cy, r, a0, a1)` · L3672–3692
- <a id="fn-perf-mon-js-makegauge"></a>`makeGauge(o)` · L3698–3832 · @param {object} o {size, label, unit, max, redFrom, invert} invert: low values are the problem (used for FPS)
- <a id="fn-perf-mon-js-makegauge-set"></a>`makeGauge.set(v, displayText)` · L3822–3830
- <a id="fn-perf-mon-js-makelamp"></a>`makeLamp(label)` · L3834–3849
- <a id="fn-perf-mon-js-buildui"></a>`buildUI()` · L3861–4008
- <a id="fn-perf-mon-js-setrow"></a>`setRow(container, cells)` · L4010–4030
- <a id="fn-perf-mon-js-renderengine"></a>`renderEngine(c)` · L4032–4094
- <a id="fn-perf-mon-js-renderfeatures"></a>`renderFeatures(c)` · L4096–4134
- <a id="fn-perf-mon-js-renderfunctions"></a>`renderFunctions(c)` · L4136–4166
- <a id="fn-perf-mon-js-rendersystems"></a>`renderSystems(c)` · L4168–4256
- <a id="fn-perf-mon-js-updateui"></a>`updateUI()` · L4258–4330
- <a id="fn-perf-mon-js-show"></a>`show()` · L4334–4345
- <a id="fn-perf-mon-js-hide"></a>`hide()` · L4347–4354
- <a id="fn-perf-mon-js-toggle"></a>`toggle()` · L4356–4359
- <a id="fn-perf-mon-js-issynthetickey"></a>`isSyntheticKey(evt)` · L4411–4414
- <a id="fn-perf-mon-js-istogglepress"></a>`isTogglePress(evt, code)` · L4416–4433
- <a id="fn-perf-mon-js-consume"></a>`consume(evt)` · L4443–4447 · ui.js binds its shortcut router with document.addEventListener('keydown', handler, true) - the same node and the same phase as us.
- <a id="fn-perf-mon-js-installremote"></a>`installRemote()` · L4449–4496
- <a id="fn-perf-mon-js-boot"></a>`boot()` · L4513–4572
- <a id="fn-perf-mon-js-armouter"></a>`armOuter()` · L4576–4581 · Outer probes go on last, once every other module in the bundle has installed its own hooks — that is what makes the parse sandwich work.
- <a id="fn-perf-mon-js-window-perf-report"></a>`window.__PERF.report(reason)` · L4602–4604 · Full machine-readable snapshot, also printed to the console.
- <a id="fn-perf-mon-js-window-perf-sweep"></a>`window.__PERF.sweep()` · L4608–4610 · Re-run the feature expectation sweep right now.
- <a id="fn-perf-mon-js-window-perf-features"></a>`window.__PERF.features()` · L4612–4624 · What every feature should be doing on this page, and whether it is.
- <a id="fn-perf-mon-js-window-perf-functions"></a>`window.__PERF.functions(windowMs)` · L4626–4631 · Hottest instrumented functions in the last N ms.
- <a id="fn-perf-mon-js-window-perf-registry"></a>`window.__PERF.registry()` · L4633–4635 · Everything the monitor knows about the codebase.
- <a id="fn-perf-mon-js-window-perf-calibrate"></a>`window.__PERF.calibrate(samples, iterations)` · L4654–4694 · Definitive measurement of what the mod's JSON filtering actually costs.
- <a id="fn-perf-mon-js-window-perf-wrapprotos"></a>`window.__PERF.__wrapProtos()` · L4697–4702 · Force a prototype-instrumentation pass (normally polled every 2s).
- <a id="fn-perf-mon-js-window-perf-help"></a>`window.__PERF.help()` · L4706–4738
