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

4735 lines · imported by [userScript.js](app.md#mod-userscript-js)

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
- <a id="fn-perf-mon-js-modulefromsource"></a>`moduleFromSource(fn)` · L305–317
- <a id="fn-perf-mon-js-capturestack"></a>`captureStack()` · L556–566
- <a id="fn-perf-mon-js-modulefromstack"></a>`moduleFromStack(stack)` · L568–579
- <a id="fn-perf-mon-js-isourcode"></a>`isOurCode(stack)` · L581–586
- <a id="fn-perf-mon-js-originof"></a>`originOf(fn, hint)` · L591–634 · Resolve and memoise {module, fn, role, cost, ours} for a callback.
- <a id="fn-perf-mon-js-unknownorigin"></a>`unknownOrigin(hint)` · L636–647
- <a id="fn-perf-mon-js-ledgerfor"></a>`ledgerFor(origin)` · L660–671
- <a id="fn-perf-mon-js-modulemeter"></a>`moduleMeter(mod)` · L673–677
- <a id="fn-perf-mon-js-currentcontext"></a>`currentContext()` · L679–681
- <a id="fn-perf-mon-js-charge"></a>`charge(origin, fn, thisArg, args)` · L684–699 · Run fn under an attribution context and charge its inclusive wall time.
- <a id="fn-perf-mon-js-topfunctions"></a>`topFunctions(limit, windowMs)` · L701–725
- <a id="fn-perf-mon-js-channel"></a>`channel(name)` · L792–805
- <a id="fn-perf-mon-js-detectpage"></a>`detectPage()` · L814–825
- <a id="fn-perf-mon-js-onpagechange"></a>`onPageChange(fn)` · L828–830
- <a id="fn-perf-mon-js-checkpage"></a>`checkPage()` · L832–849
- <a id="fn-perf-mon-js-keepsample"></a>`keepSample(text)` · L868–875
- <a id="fn-perf-mon-js-synthorigin"></a>`synthOrigin(fnName, fallbackModule)` · L887–898
- <a id="fn-perf-mon-js-chargehook"></a>`chargeHook(origin, msSpent)` · L900–906
- <a id="fn-perf-mon-js-classifyresponse"></a>`classifyResponse(text)` · L908–920
- <a id="fn-perf-mon-js-typebucket"></a>`typeBucket(t)` · L922–934
- <a id="fn-perf-mon-js-installinnerjsonprobe"></a>`installInnerJsonProbe()` · L936–961
- <a id="fn-perf-mon-js-installinnerjsonprobe-innerparse"></a>`installInnerJsonProbe.innerParse(text, reviver)` · L939–948
- <a id="fn-perf-mon-js-installinnerjsonprobe-json-stringify"></a>`installInnerJsonProbe.JSON.stringify(value, replacer, space)` · L953–960
- <a id="fn-perf-mon-js-installouterjsonprobe"></a>`installOuterJsonProbe()` · L963–1046
- <a id="fn-perf-mon-js-installouterjsonprobe-outerparse"></a>`installOuterJsonProbe.outerParse(text, reviver)` · L981–1018
- <a id="fn-perf-mon-js-installouterjsonprobe-json-stringify"></a>`installOuterJsonProbe.JSON.stringify(value, replacer, space)` · L1023–1043
- <a id="fn-perf-mon-js-classifyurl"></a>`classifyUrl(url)` · L1063–1069
- <a id="fn-perf-mon-js-recordrequest"></a>`recordRequest(kind, method, url, ms, ok)` · L1071–1096
- <a id="fn-perf-mon-js-installnetworkprobes"></a>`installNetworkProbes()` · L1098–1218
- <a id="fn-perf-mon-js-installnetworkprobes-navigator-sendbeacon"></a>`installNetworkProbes.navigator.sendBeacon(url, _data)` · L1105–1119
- <a id="fn-perf-mon-js-installnetworkprobes-window-fetch"></a>`installNetworkProbes.window.fetch(resource, init)` · L1127–1164
- <a id="fn-perf-mon-js-installnetworkprobes-window-fetch-done"></a>`installNetworkProbes.window.fetch.done(ok)` · L1133–1138
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-open"></a>`installNetworkProbes.XHR.prototype.open(method, url)` · L1173–1181
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send"></a>`installNetworkProbes.XHR.prototype.send()` · L1183–1216
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send-finish"></a>`installNetworkProbes.XHR.prototype.send.finish()` · L1188–1196
- <a id="fn-perf-mon-js-installnetworkprobes-xhr-prototype-send-this-onreadystatechange"></a>`installNetworkProbes.XHR.prototype.send.this.onreadystatechange()` · L1201–1204
- <a id="fn-perf-mon-js-describetarget"></a>`describeTarget(target)` · L1230–1242
- <a id="fn-perf-mon-js-describeoptions"></a>`describeOptions(o)` · L1244–1254
- <a id="fn-perf-mon-js-registerobserver"></a>`registerObserver(rec)` · L1256–1260
- <a id="fn-perf-mon-js-installobserverprobes"></a>`installObserverProbes()` · L1262–1371
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo"></a>`installObserverProbes.PatchedMO(callback)` · L1268–1326
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-wrapped"></a>`installObserverProbes.PatchedMO.wrapped(records, observer)` · L1282–1302
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-inst-observe"></a>`installObserverProbes.PatchedMO.inst.observe(target, options)` · L1310–1319
- <a id="fn-perf-mon-js-installobserverprobes-patchedmo-inst-disconnect"></a>`installObserverProbes.PatchedMO.inst.disconnect()` · L1320–1323
- <a id="fn-perf-mon-js-installobserverprobes-patchedio"></a>`installObserverProbes.PatchedIO(callback, options)` · L1334–1367
- <a id="fn-perf-mon-js-installobserverprobes-patchedio-wrapped"></a>`installObserverProbes.PatchedIO.wrapped(entries, observer)` · L1347–1353
- <a id="fn-perf-mon-js-installobserverprobes-patchedio-inst-observe"></a>`installObserverProbes.PatchedIO.inst.observe(target)` · L1356–1364
- <a id="fn-perf-mon-js-installtimerprobes"></a>`installTimerProbes()` · L1377–1479
- <a id="fn-perf-mon-js-installtimerprobes-window-settimeout"></a>`installTimerProbes.window.setTimeout(fn, delay)` · L1384–1402
- <a id="fn-perf-mon-js-installtimerprobes-window-settimeout-wrapped"></a>`installTimerProbes.window.setTimeout.wrapped()` · L1393–1400
- <a id="fn-perf-mon-js-installtimerprobes-window-setinterval"></a>`installTimerProbes.window.setInterval(fn, delay)` · L1404–1435
- <a id="fn-perf-mon-js-installtimerprobes-window-setinterval-wrapped"></a>`installTimerProbes.window.setInterval.wrapped()` · L1420–1430
- <a id="fn-perf-mon-js-installtimerprobes-window-clearinterval"></a>`installTimerProbes.window.clearInterval(id)` · L1437–1440
- <a id="fn-perf-mon-js-installtimerprobes-window-requestanimationframe"></a>`installTimerProbes.window.requestAnimationFrame(fn)` · L1444–1477
- <a id="fn-perf-mon-js-installtimerprobes-window-requestanimationframe-wrapped"></a>`installTimerProbes.window.requestAnimationFrame.wrapped(ts)` · L1451–1475
- <a id="fn-perf-mon-js-installdomprobes"></a>`installDomProbes()` · L1488–1537
- <a id="fn-perf-mon-js-installdomprobes-wrapquery"></a>`installDomProbes.wrapQuery(proto, name, counter, meter)` · L1490–1503
- <a id="fn-perf-mon-js-installdomprobes-wrapquery-proto-name"></a>`installDomProbes.wrapQuery.proto[name](_sel)` · L1493–1502
- <a id="fn-perf-mon-js-installdomprobes-element-prototype-getboundingclientrect"></a>`installDomProbes.Element.prototype.getBoundingClientRect()` · L1524–1527
- <a id="fn-perf-mon-js-installdomprobes-window-getcomputedstyle"></a>`installDomProbes.window.getComputedStyle()` · L1531–1534
- <a id="fn-perf-mon-js-listenerkey"></a>`listenerKey(type, options)` · L1549–1552
- <a id="fn-perf-mon-js-installeventprobes"></a>`installEventProbes()` · L1554–1600
- <a id="fn-perf-mon-js-installeventprobes-et-prototype-addeventlistener"></a>`installEventProbes.ET.prototype.addEventListener(type, listener, options)` · L1562–1588
- <a id="fn-perf-mon-js-installeventprobes-et-prototype-removeeventlistener"></a>`installEventProbes.ET.prototype.removeEventListener(type, listener, options)` · L1590–1599
- <a id="fn-perf-mon-js-wrapprototype"></a>`wrapPrototype(obj, moduleName)` · L1626–1677
- <a id="fn-perf-mon-js-wrapprototype-wrapper"></a>`wrapPrototype.wrapper()` · L1657–1659
- <a id="fn-perf-mon-js-pollforprototypes"></a>`pollForPrototypes()` · L1679–1692
- <a id="fn-perf-mon-js-pollforprototypes-tick"></a>`pollForPrototypes.tick()` · L1681–1689
- <a id="fn-perf-mon-js-q"></a>`q(sel)` · L1704–1710
- <a id="fn-perf-mon-js-qa"></a>`qa(sel)` · L1711–1717
- <a id="fn-perf-mon-js-byid"></a>`byId(id)` · L1718–1724
- <a id="fn-perf-mon-js-hasclass"></a>`hasClass(cls)` · L1725–1727
- <a id="fn-perf-mon-js-cfg"></a>`cfg()` · L1773–1790
- <a id="fn-perf-mon-js-cfgget"></a>`cfgGet(key)` · L1792–1795
- <a id="fn-perf-mon-js-chan"></a>`chan(name)` · L1815–1817
- <a id="fn-perf-mon-js-chanrate"></a>`chanRate(name, w)` · L1818–1821
- <a id="fn-perf-mon-js-fnstats"></a>`fnStats(module, fn)` · L1822–1832
- <a id="fn-perf-mon-js-anyfnran"></a>`anyFnRan(module, fns)` · L1833–1839
- <a id="fn-perf-mon-js-isupgradedtile"></a>`isUpgradedTile(el)` · L1854–1860
- <a id="fn-perf-mon-js-countupgradedthumbs"></a>`countUpgradedThumbs()` · L1862–1880
- <a id="fn-perf-mon-js-playervideo"></a>`playerVideo()` · L1883–1885 · The one &lt;video> the mod cares about.
- <a id="fn-perf-mon-js-ensurevideotickprobe"></a>`ensureVideoTickProbe()` · L1894–1907
- <a id="fn-perf-mon-js-countdom"></a>`countDom()` · L1916–1944 · getElementsByTagName('\*') stops at a shadow boundary, and YouTube's ytlr-\* elements are custom elements that may hold their subtree in a shadow root.
- <a id="fn-perf-mon-js-observersfrom"></a>`observersFrom(moduleName)` · L1946–1953
- <a id="fn-perf-mon-js-parsetypeseen"></a>`parseTypeSeen(type, withinMs)` · L1954–1959
- <a id="fn-perf-mon-js-allfeatures"></a>`allFeatures()` · L2696–2698
- <a id="fn-perf-mon-js-featureenabled"></a>`featureEnabled(f)` · L2700–2705
- <a id="fn-perf-mon-js-evaluatefeature"></a>`evaluateFeature(f, page)` · L2711–2760 · Evaluate one feature against the current page.
- <a id="fn-perf-mon-js-evaluateall"></a>`evaluateAll(page)` · L2762–2768
- <a id="fn-perf-mon-js-evaluateallcached"></a>`evaluateAllCached(ttl)` · L2777–2784
- <a id="fn-perf-mon-js-dedupe"></a>`dedupe(list)` · L2793–2802
- <a id="fn-perf-mon-js-runsweep"></a>`runSweep(page, reason)` · L2804–2852
- <a id="fn-perf-mon-js-logsweep"></a>`logSweep(sweep)` · L2864–2928
- <a id="fn-perf-mon-js-findbottlenecks"></a>`findBottlenecks()` · L3224–3235
- <a id="fn-perf-mon-js-buildreport"></a>`buildReport()` · L3241–3420
- <a id="fn-perf-mon-js-coverage"></a>`coverage()` · L3422–3444
- <a id="fn-perf-mon-js-emitreport"></a>`emitReport(reason)` · L3449–3499
- <a id="fn-perf-mon-js-maybeemitreport"></a>`maybeEmitReport(reason)` · L3501–3516
- <a id="fn-perf-mon-js-installvitals"></a>`installVitals()` · L3522–3602
- <a id="fn-perf-mon-js-installvitals-loop"></a>`installVitals.loop()` · L3527–3539
- <a id="fn-perf-mon-js-el"></a>`el(tag, styles, text)` · L3637–3647 · All elements are created here so they can all carry the `twemoji-injected` marker: emoji-font.js treats that class as "already processed" and skips the subtree, which keeps the monitor out of the observer it is measur...
- <a id="fn-perf-mon-js-svg"></a>`svg(tag, attrs)` · L3649–3657
- <a id="fn-perf-mon-js-polar"></a>`polar(cx, cy, r, deg)` · L3662–3665
- <a id="fn-perf-mon-js-arcpath"></a>`arcPath(cx, cy, r, a0, a1)` · L3667–3687
- <a id="fn-perf-mon-js-makegauge"></a>`makeGauge(o)` · L3693–3827 · @param {object} o {size, label, unit, max, redFrom, invert} invert: low values are the problem (used for FPS)
- <a id="fn-perf-mon-js-makegauge-set"></a>`makeGauge.set(v, displayText)` · L3817–3825
- <a id="fn-perf-mon-js-makelamp"></a>`makeLamp(label)` · L3829–3844
- <a id="fn-perf-mon-js-buildui"></a>`buildUI()` · L3856–4003
- <a id="fn-perf-mon-js-setrow"></a>`setRow(container, cells)` · L4005–4025
- <a id="fn-perf-mon-js-renderengine"></a>`renderEngine(c)` · L4027–4089
- <a id="fn-perf-mon-js-renderfeatures"></a>`renderFeatures(c)` · L4091–4129
- <a id="fn-perf-mon-js-renderfunctions"></a>`renderFunctions(c)` · L4131–4161
- <a id="fn-perf-mon-js-rendersystems"></a>`renderSystems(c)` · L4163–4251
- <a id="fn-perf-mon-js-updateui"></a>`updateUI()` · L4253–4325
- <a id="fn-perf-mon-js-show"></a>`show()` · L4329–4340
- <a id="fn-perf-mon-js-hide"></a>`hide()` · L4342–4349
- <a id="fn-perf-mon-js-toggle"></a>`toggle()` · L4351–4354
- <a id="fn-perf-mon-js-issynthetickey"></a>`isSyntheticKey(evt)` · L4406–4409
- <a id="fn-perf-mon-js-istogglepress"></a>`isTogglePress(evt, code)` · L4411–4428
- <a id="fn-perf-mon-js-consume"></a>`consume(evt)` · L4438–4442 · ui.js binds its shortcut router with document.addEventListener('keydown', handler, true) - the same node and the same phase as us.
- <a id="fn-perf-mon-js-installremote"></a>`installRemote()` · L4444–4491
- <a id="fn-perf-mon-js-boot"></a>`boot()` · L4508–4567
- <a id="fn-perf-mon-js-armouter"></a>`armOuter()` · L4571–4576 · Outer probes go on last, once every other module in the bundle has installed its own hooks — that is what makes the parse sandwich work.
- <a id="fn-perf-mon-js-window-perf-report"></a>`window.__PERF.report(reason)` · L4597–4599 · Full machine-readable snapshot, also printed to the console.
- <a id="fn-perf-mon-js-window-perf-sweep"></a>`window.__PERF.sweep()` · L4603–4605 · Re-run the feature expectation sweep right now.
- <a id="fn-perf-mon-js-window-perf-features"></a>`window.__PERF.features()` · L4607–4619 · What every feature should be doing on this page, and whether it is.
- <a id="fn-perf-mon-js-window-perf-functions"></a>`window.__PERF.functions(windowMs)` · L4621–4626 · Hottest instrumented functions in the last N ms.
- <a id="fn-perf-mon-js-window-perf-registry"></a>`window.__PERF.registry()` · L4628–4630 · Everything the monitor knows about the codebase.
- <a id="fn-perf-mon-js-window-perf-calibrate"></a>`window.__PERF.calibrate(samples, iterations)` · L4649–4689 · Definitive measurement of what the mod's JSON filtering actually costs.
- <a id="fn-perf-mon-js-window-perf-wrapprotos"></a>`window.__PERF.__wrapProtos()` · L4692–4697 · Force a prototype-instrumentation pass (normally polled every 2s).
- <a id="fn-perf-mon-js-window-perf-help"></a>`window.__PERF.help()` · L4701–4733
