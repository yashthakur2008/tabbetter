# Discovery Workspace Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent ownership and review each integration boundary.

**Goal:** Deliver a spacious speech-and-debate discovery frontend with published-event/circuit filtering and optional local discovery.

**Architecture:** Add a pure discovery module shared by browser and worker, bounded public metadata enrichment and a same-origin geocoder adapter. Replace the homepage structure in a focused browser module, retaining the existing routing and saved-item contracts. Verify real built workflows and keep incomplete source coverage explicit.

**Tech Stack:** Vanilla JavaScript, CSS, Node built-in test runner, generated Fetch API worker, Open-Meteo/GeoNames forward geocoding.

**Spec:** docs/superpowers/specs/2026-11-10-discovery-workspace-design.md

## Global Constraints

- Light-first, spacious, no decorative divider lines; speech and debate have equal priority.
- No Tabroom credentials or cookies, no fabricated event/circuit/venue data.
- Event filters disclose partial metadata coverage. Missing location never becomes zero distance.
- Geolocation is opt-in and stays in memory; manual city/postal search explicitly discloses Open-Meteo/GeoNames.
- Browser position never goes to geocoding API. Approximate event-city coordinates require explicit metadata and unambiguous matches.
- Preserve member routes, saved tournaments, source status, existing themes, export and keyboard/touch accessibility.
- PRs only, no merges or deployments.

## Files and ownership

- `src/discovery.mjs`: event taxonomy/aliases, validation, distance and deterministic discovery filtering; data worker owns.
- `src/discovery-api.mjs`: bounded metadata and geocoding helpers; data worker owns.
- `src/server.mjs`: same-origin discovery routes; data worker owns.
- `scripts/compile.mjs`: embed discovery shared/API/browser modules and CSS safely; data worker owns.
- `web/discovery.js`, `web/discovery.css`: new homepage composition and interaction lifecycle; frontend worker owns.
- `web/app.js`, `web/index.html`, `web/styles.css`: minimal integration and replacement of homepage-specific obsolete styling; frontend worker owns.
- `tests/discovery*.test.mjs`: split pure/API tests (data worker) and UI-contract tests (frontend worker).
- `scripts/test-discovery-browser.cjs`: representative browser regression checks; coordinator owns.

## Shared contract

`DISCOVERY_EVENTS`: array of `{id,label,group,aliases}`; group is `speech` or `debate`.
`classifyEvents(events)`: array of distinct `{id,label,group,sourceLabel}` from published event objects/strings; retain unknown labels with group `other`.
`distanceKm(a,b)`: finite kilometers or null, points `{latitude,longitude}`.
`discoverTournaments(tournaments, metadata, options)`: array of copied tournament summaries with `discovery` property `{events,distanceKm,eventMatches,metadataStatus,circuitLabels}`. Metadata is an object keyed by tournament ID. Options `{query,eventIds,eventMatch:'any'|'all',origin,radiusKm,includeOnline,sort:'date'|'distance'|'matches'|'name'}`. Missing values get safe defaults. Stable date/name/ID tie-breaks. Online-only is never a geographic hit.
`GET /api/discovery?ids=1,2`: maximum 12 validated IDs per call; returns `{items:[{id,events,status,coordinates,circuits,sourceUrl,fetchedAt}],partial:true}`. Invalid input 400; unavailable per-item metadata is explicit rather than discarding successful items. Global in-isolate concurrency limit 3, public metadata caching; do not turn single visits into full-calendar scrapes.
`GET /api/locations?q=San%20Jose%2C%20CA`: explicit search only, 2–100 chars; returns `{results:[{id,label,latitude,longitude}],attribution:'Open-Meteo / GeoNames'}`. Limit to 5 candidates, validate coordinates and labels, no arbitrary upstream URL, timeout/error -> controlled 502. Manual requests have no-store browser cache policy.

## Task 1: Pure discovery contracts (data worker)

- [ ] Add tests before implementation: `assert.equal(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0)`; invalid bounds => null; `classifyEvents([{name:'Varsity Original Oratory'}])` includes Original Oratory, not a generic debate event. Test PF/LD aliases, extemp speech vs debate, ANY/ALL, unknown metadata, online-only and deterministic tie-breaks.
- [ ] Run `node --test tests/discovery.test.mjs` and observe failing import/assertions.
- [ ] Implement pure exported functions according to shared contract without browser/network access. Distance uses Haversine with finite/bounds checks and clamps floating-point domain.
- [ ] Rerun focused tests and commit only owned files.

## Task 2: API and compiler integration (data worker)

- [ ] Write worker Fetch interface tests using mocked fetch: invalid IDs do not touch network; partial upstream failure preserves successes; repeated requests reuse cache; location requests validate query/results and return controlled errors; no user coordinates appear in upstream requests.
- [ ] Implement bounded enrichment using public exports and normalizer. Circuit tags require source evidence, not name matching. For physical event-city geocoding, use city plus published state/country, and accept only exact city and compatible region/country matching with a single candidate; otherwise return no coordinates. Skip online/timezone/unspecified strings.
- [ ] Forward geocoder requests only to `https://geocoding-api.open-meteo.com/v1/search` with name/count=5/language=en/format=json. Document noncommercial limits and attribution. Coalesce/cap calls; use timeout and strict response shape checks.
- [ ] Embed discovery source before app.js and discovery API helpers before server.mjs. Include web/discovery.js after app.js and web/discovery.css after legacy CSS. Add closing-tag guards for all new embedded assets. Existing app must fall back gracefully if discovery UI has not loaded yet.
- [ ] Run `npm test`, `npm run check`, `npm run validate`; commit data/API/compiler files only.

## Task 3: Workspace UI (frontend worker)

- [ ] Write rendering/interaction tests for a single visible search, speech/debate filters, location consent, unknown coverage labels, ordinary tournament links and keyboard-preview affordances. Preserve old helper functions used by existing tests where reasonable, but remove duplicate homepage search from active rendering.
- [ ] Implement dedicated discovery module exposing `renderDiscoveryWorkspace()` and call it from `calendarShell()` when available. The module may use existing `calendar`, `saved`, `route`, `navigate`, `save`, `esc`, `filter` and APIs. Ensure initial load renders after script initialization and route changes use the new shell.
- [ ] Use one list/grid whose rows show dates/title/city/events/circuit/status and save/preview. Replace hero/stat tiles with concise heading, search, filter toolbar and result summary. Explicit event selector groups speech and debate; chips remove individual filters. Circuit selection continues fetching the existing filtered calendar endpoint.
- [ ] Fetch metadata in visible batches of at most 12, never a blind full-calendar loop. Show checked coverage and explicit load-more metadata action so filtering does not imply complete source coverage. Distances appear only after optional location setup; unknown results are labelled honestly. Clear all resets query/events/circuit/location/radius and preserves saved bookmarks.
- [ ] Implement consented city/ZIP form, choose-from-candidates, optional geolocation button, error states and clear-location. Late responses cannot restore cleared selections. No localStorage location persistence.
- [ ] Preview must preserve keyboard focus, close on Escape and have an ordinary open-tournament link; save must not activate preview. Cmd/Ctrl+K focuses search without hijacking editable fields unexpectedly. Preserve navigation/back and avoid leaked listeners on rerender.
- [ ] Use light-first off-white/ink palette, generous whitespace, no decorative dividers, distinct interaction/focus/selected states. Keep dark theme readable as an option. Animate meaningful changes at 140–240ms; reduced motion disables movement. Update old contradictory homepage CSS instead of a third giant override patch.
- [ ] Run focused and full tests; commit owned frontend files only.

## Task 4: Integrated verification and publication (coordinator)

- [ ] Review source diff and run `npm test && npm run check && npm run validate && git diff --check`.
- [ ] Exercise compiled worker with representative fixtures in a browser: initial route, filtering speech/debate and circuit, metadata unavailable, ANY/ALL, event ranking, manual location candidates, geolocation allow/deny, distance sorting/radius/online group, save/reload, clear-all, stale response cancellation, keyboard preview/Escape/focus, back navigation.
- [ ] At widths 320/390/768/1440 assert document width <= viewport width. Check reduced-motion computed animation/transition behavior and screenshots for hierarchy and spacing. Test both light and optional dark themes, without claiming aesthetic approval from automated checks alone.
- [ ] Run live read-only smoke requests to calendar, one tournament discovery batch and geocoder. If upstream is unavailable, report the limitation and preserve user-facing errors rather than substituting invented records.
- [ ] Request independent review of correctness/security/UX with tests. Fix substantive findings and rerun affected checks plus whole suite.
- [ ] Publish feature PRs against the preserved GitHub history. Report actual URLs, checks, source-coverage limits and any remaining work. Do not claim account login or private paradigms implemented.

## Self-review

All spec areas map to Tasks 1–4. Data contracts distinguish source incompleteness and unknown distance. Source metadata rather than schools supplies locations; exact city matching is required. Clear-all and late-response behavior are explicit. Existing 2023–27 database preference is not fabricated into this homepage slice. The approved continuation authorizes implementation without another question.
