# Task 2 implementation report

Date: 2026-11-17
Branch: `design/competition-workspace`
Requested baseline: `994d2f9`
Implementation: **`638396d`**, `feat: refine competition directory and unify tournament branding`
Review range: `994d2f9..638396d`, excluding coordinator-owned documentation commit `b2ca4bc`. This report is committed separately after the implementation. No branch switch, subagents, push, merge or deployment occurred.

## Delivered

- Compact tournament directory with aligned date, name/events, location/format, registration and action columns. Narrow layouts stack labeled fields. Ordinary tournament links, Preview and Save remain real controls with at least 44px height.
- Plain Tournaments / Saved tournaments headings, reduced whitespace and a concise coverage warning. An explicit **About event coverage** disclosure retains the unchecked/unavailable-match explanation and one-minute retry guidance. Retry remains visible when recovery is possible. Check-next behavior and bounded metadata requests are unchanged. The completed/disabled check-next action is no longer displayed as a useless action.
- Deduplicated exact repeated location/mode strings, including `Online · Online`. No inference of a physical location or published event was added.
- Explicit primary tournament tasks, in order: **Overview, Schedule, Pairings, Entries, Judges, Results**. Events, Schools, Statistics and Resources remain in a separately labeled additional navigation row. Both rows wrap instead of requiring horizontal scrolling. Current task has `aria-current="page"`. Existing hashes and handlers remain unchanged.
- Rankings unavailable now explicitly explains that this is not a sign-in issue and links to tournament discovery and Help. No login, corpus, ranking or result behavior changed.
- One speech-bubble/round-sheet mark derived from the supplied generated concept. Teal bubble, two aligned white lines and round dot, without texture. Header and About use the same SVG URL, with decorative empty alt text and the existing **TabBetter home** accessible link name.
- Exact SVG-derived 16px/32px PNGs, 180px touch icon, two-resolution ICO and monochrome vector. Replaced the old `assets/logo.png` contents too. `scripts/render-brand-icons.mjs` reproduces raster variants using existing Playwright without installing dependencies.
- Compiled Worker serves actual asset bytes with explicit MIME and `nosniff`. Versioned `/assets/*-v2.*` URLs use one-year immutable caching. `/favicon.ico` and `/logo.png` are revalidating compatibility aliases to the current mark.
- Task 1 sidebar, drawer, settings and tutorial behavior preserved. The only change to `web/workspace.css` is welcome-offer presentation: reduced padding, wrapping inline controls, unchanged text and IDs, 44px buttons. No tutorial JS, preference keys, state transitions or settings layout changed.

## Source ownership and interfaces

Production: `web/app.js`, `web/discovery.js`, `web/discovery.css`, `web/index.html`, `web/styles.css`, welcome-only definitions in `web/workspace.css`, `scripts/compile.mjs`, `src/server.mjs`, assets and `scripts/render-brand-icons.mjs`.

Tests: new `tests/branding.test.mjs` and `tests/competition-browser.test.mjs`; updated `brand`, `discovery-ui`, `presentation`, `server-rankings` and `spotlight` tests.

Preserved interfaces: `data-discovery-row`, `data-tournament-link`, `data-preview`, `data-discovery-save`, discovery filter/control IDs, `data-sub`, all existing tournament section hashes, `#settings`, tutorial IDs/APIs and `tabbetter-workspace-v1`. `tournamentNavigationHTML(sub)` is a pure renderer used by the actual `renderDetail()` implementation, not an alternative test-only flow. Compiler adds `brandAssets` as the Worker asset map. The isolated rankings server VM fixture now supplies that compiler-owned dependency.

Asset routes:

| Route | MIME | Cache |
|---|---|---|
| `/assets/mark-v2.svg` | `image/svg+xml` | immutable |
| `/assets/mark-mono-v2.svg` | `image/svg+xml` | immutable |
| `/assets/favicon-16-v2.png` | `image/png` | immutable |
| `/assets/favicon-32-v2.png` | `image/png` | immutable |
| `/assets/touch-icon-v2.png` | `image/png` | immutable |
| `/assets/favicon-v2.ico` | `image/x-icon` | immutable |
| `/favicon.ico` | `image/x-icon` | `no-cache` |
| `/logo.png` | `image/png` | `no-cache` |

## TDD and regression handling

Tests were added and observed failing before the relevant production changes: missing asset routes/declarations, missing labeled row fields, coverage disclosure, task navigation and rankings guidance. A real compiled-browser density test subsequently reproduced the first fresh-mobile title below the fold at **1032.20px**. Tightening the welcome/results layout and removing redundant directory introduction text made that acceptance test pass. A separate conventional-favicon test failed with **404**, then passed after the actual ICO route was implemented.

Old assertions were changed only where intentional presentation requirements invalidated them: inline theme-colored logo versus canonical SVG image, 24px borderless card spacing versus compact separated rows, retry button wording, and moving retry timing explanation into the disclosure. Behavioral assertions for filters, retry timing, routes, storage, scoring, rankings caching and source access remain. The old browser harnesses were not modified in this task.

The coordinator's security review note was applied: the new browser test server logs diagnostic errors server-side and returns only `Internal server error`, not the exception text.

## Final validation

Environment: existing Node **26.7.0** and existing Playwright at `/Users/yashthakur/github/trailblazer-website/node_modules/playwright`. No package or browser installation.

| Check | Observed result |
|---|---|
| `PLAYWRIGHT_MODULE=.../playwright/index.mjs npm test` | **337 passed, 0 failed, 0 skipped**. Includes real Chromium workspace and competition tests. |
| `BROWSER_ENGINE=firefox ... node --test tests/competition-browser.test.mjs tests/workspace-browser.test.mjs` | **5 passed**, no skips |
| Same command with `BROWSER_ENGINE=webkit` | **5 passed**, no skips |
| `TABBETTER_PLAYWRIGHT_MODULE=.../playwright node scripts/test-discovery-browser.cjs` | All existing workflows passed |
| `... node scripts/test-member-paradigms-browser.cjs` | All existing workflows passed, zero browser runtime errors and no app paradigm fetches |
| `npm run check` | Repository hygiene and source syntax passed |
| `npm run validate` | Valid ESM artifact exporting `default.fetch` |
| `git diff --check` | Passed |
| Compiled brand route tests | All eight routes return exact expected bytes, MIME and appropriate caching; declared PNG dimensions and both ICO payloads checked |
| Served SVG versus PNG canvas pixel comparison | Mean channel difference **0** at **16, 32 and 180px** in Chromium |

Existing discovery suite exercises ANY/ALL events, source-backed circuit filters, location/radius, online inclusion, sort, CSV, previews/focus, saves, keyboard shortcuts, geolocation allow/deny, stale request handling, reduced motion, theme and return navigation. Workspace tests retain tutorial lifecycle, dialog Tab/Shift+Tab/Escape, drawer navigation, storage denial/malformed-state recovery, text size and motion checks. New competition tests activate all ten task/additional routes, verify current state, actual loaded brand images, rankings guidance, fresh/dismissed visibility and large-text reflow.

The comparison harness also passed event ANY/ALL, speech/debate selections, radius/online inclusion, location permissions/manual fallback and disclosure-overflow checks for all three compared revisions. It executes actual compiled Worker/adapters/DOM, intercepting only external fixture data.

## Density measurements

All values below are CSS pixels at scroll position zero after fonts and metadata settle. Deterministic comparison uses **the same four external tournament fixtures**, with **4 of 4 checked and 3 with published details**. All four rows are rendered. This is not a claim about live tournament availability. `baseline-audit.md` separately observed 257 live tournaments with 24 rendered; that audit remains unchanged.

- Original pre-redesign archive: `6414e2c`.
- Task 2 starting archive: `994d2f9`.
- Current: compiled implementation `638396d`.
- Fresh means the actual welcome is visible. Returning means **Not now** was explicitly activated. The original baseline had no tutorial offer, so its measurements are identical in both states.

| Revision / state | Viewport | First row top | First title top | First row height | Fully visible rows |
|---|---|---:|---:|---:|---:|
| Original baseline | 1440×1000 | 529.30 | 554.30 | 134.30 | 3 |
| Task 1 fresh | 1440×1000 | 714.89 | 739.89 | 134.30 | 2 |
| Task 1 returning | 1440×1000 | 529.30 | 554.30 | 134.30 | 3 |
| **Task 2 fresh** | **1440×1000** | **534.55** | **546.55** | **114.50** | **4** |
| **Task 2 returning** | **1440×1000** | **425.36** | **437.36** | **114.50** | **4** |
| Original baseline | 390×900 | 887.33 | 937.33 | 267.80 | 0 |
| Task 1 fresh | 390×900 | 1104.92 | 1154.92 | 267.80 | 0 |
| Task 1 returning | 390×900 | 863.33 | 913.33 | 267.80 | 0 |
| **Task 2 fresh** | **390×900** | **749.30** | **788.30** | **249.50** | **0** |
| **Task 2 returning** | **390×900** | **594.11** | **633.11** | **249.50** | **1** |

**Tradeoff:** fresh mobile now shows the first tournament name and event tags, but not the complete row/actions. The welcome is not hidden to manufacture density. Returning mobile shows a complete first row. Desktop fresh is almost back to the original first-row position despite adding the welcome, and fits all four comparison rows. An independent eight-record acceptance fixture fits **4 fresh / 5 returning desktop rows**, with a shorter two-event mobile row at **224px**.

### Large-text measurements

Actual Settings selects Extra large (150%), rather than tests writing a dataset directly. Directory and tournament screens in **Chromium, Firefox and WebKit** each measured document widths of **320, 390, 768 and 1440px** at the corresponding viewport widths: **zero horizontal document overflow**. Directory link/button minimum height was **44px** in every tested width/engine. All six task buttons remained horizontally in-bounds and at least 44px high. Primary navigation wraps visibly. No overflow-hiding CSS was added.

## Evidence locations

Evidence root: `/Users/yashthakur/.jcode/scratch/tabbetter-workspace-20261117/evidence/`.

- `baseline,task2base,current-results.json`: complete matched before/after measurements, records, source calls, capabilities and fresh/returning metrics.
- `current-390-initial.png`: **fresh mobile welcome plus visible first title/events**, viewport screenshot. `current-390-returning.png`: dismissed welcome. `current-390-full.png`: full-page view.
- `current-1440-initial.png`, `current-1440-returning.png`: desktop equivalents. Corresponding `baseline-*` and `task2base-*` files retain before evidence.
- `task2-icons-16-32-light-dark.png`: served SVG/PNG at actual 16/32px plus enlarged exact pixels on light/dark backgrounds. This is an explicitly labeled asset contact sheet, not a browser-tab-chrome screenshot. Two lines, dot and bubble tail remain distinguishable at 16px. `task2-icon-parity.json`: zero-difference measurements.
- `task2-{chromium,firefox,webkit}-metrics.json`: fresh/dismissed and numeric extra-large directory/tournament metrics.
- `task2-{engine}-{320,390,768,1440}-extra-large-{directory,tournament}.png`: full responsive evidence. `task2-{engine}-{1440,390}-{fresh,dismissed}.png`: acceptance-fixture states.
- `task2-final-full.log`, `task2-final-firefox.log`, `task2-final-webkit.log`, `task2-final-discovery.log`, `task2-final-members.log`: final successful verification output.
- `task2-red.log`, `task2-density-red.log`, `task2-ico-red.log`: red-phase evidence. Intermediate failure logs are retained, not relabeled as final passes.

Scratch reproductions: sibling `compare-task2.cjs` is the existing comparison harness extended to measure fresh and explicitly dismissed states. `icon-evidence.cjs` creates the actual-served asset contact sheet and canvas comparison. The durable new regression harness is `tests/competition-browser.test.mjs`.

## Boundaries and follow-ups

- **Calendar download and timezone repairs are deliberately untouched.** Their baseline defects remain Task 3 work. No claim of working ICS export or corrected schedule timezones is made.
- Public/live source and deployed custom-domain smoke, independent review and release remain coordinator/Task 3 responsibilities. The complete behavior tests use deterministic external data where stated, not a claim that Tabroom currently publishes all fields.
- Branding routes were verified through the compiled local Worker, not a deployment. No deployment occurred.
- Large text prioritizes readable wrapping over the default-density targets. At 150%, rows and navigation naturally become taller. Default fresh mobile does not fit every first-row action above the fold.
- The reviewed specification's independent-companion wording and official handoffs remain. No account or fabricated personal data was introduced.

## Review follow-up: P2 pending metadata feedback

Follow-up to `task-2-review.md`, based on implementation `638396d` / report `f93873a`. The review correctly found that the former `#discovery-check-next:disabled { display: none; }` conflated busy and exhausted states. This appendix supersedes the earlier reference to hiding the “completed/disabled” action: **only idle exhaustion is hidden**, not every disabled state.

### Fix and scope

- Removed the disabled-visibility CSS rule. `discoveryDrawResults()` now explicitly sets `hidden` only when there is neither pending work nor an unchecked next batch.
- Pending checks retain a **visible, disabled** `Checking published details…` button. Pending listing refreshes likewise use an accurate `Updating tournament listing…` label, without changing any calendar/source behavior. Pending retries remain visible even when all records were previously checked.
- Added a persistent, visually hidden `#discovery-check-status` with `role="status"` and `aria-live="polite"`. It mirrors the visible busy label for assistive-technology announcement and clears when work completes. This is DOM/accessibility-markup verification, not a claim of operating a screen reader.
- Idle exhaustion still removes the action from layout. The settled compact density and responsive acceptance tests remain green. No Task 3 Calendar, timezone, source or ICS repair was made.

### Red-first reproduction and validation

New `tests/discovery-progress-browser.test.mjs` serves **24 external tournament fixtures** through the real compiled Worker and adapters. After the automatic first batch reaches 12 of 24, it gates actual external responses for the second batch, then activates the real Check next button. No application function or DOM state is substituted. An initial fixture-ordering mistake blocked the automatic batch and timed out; deterministic padded names corrected that harness issue before recording the expected regression failure.

Before the fix, the test failed specifically with `busy metadata action must not disappear with disabled state`, actual visibility **false**. After the fix, Chromium/Firefox/WebKit pass with this observed pending/completed transition:

- Pending: button text `Checking published details…`, computed display `block`, button disabled, coverage still **12 of 24 checked · 12 with published details. Matches may be incomplete.**, and **12 rows still explicitly marked Details not checked**.
- Completion after releasing the external-response gate: **24 of 24 checked · 24 with published details**, no unchecked-row labels, busy status empty, action visibility **false**.

A separate red-first unit regression covers idle/unchecked, idle/exhausted, busy metadata with no unchecked IDs (retry), pending listing and completion. Its implementation executes the actual discovery renderer.

Final follow-up checks:

| Check | Result |
|---|---|
| Full `npm test` with existing Playwright browser opt-in | **339 passed, 0 failed, 0 skipped** |
| Firefox progress + competition + workspace browser tests | **6 passed, 0 failed, 0 skipped** |
| WebKit progress + competition + workspace browser tests | **6 passed, 0 failed, 0 skipped** |
| Existing discovery browser suite | Passed unchanged |
| Existing member/paradigm browser suite | Passed unchanged |
| `npm run check`, `npm run validate`, `git diff --check` | Passed |

Follow-up evidence under the same root `/Users/yashthakur/.jcode/scratch/tabbetter-workspace-20261117/evidence/`:

- `task2-review-progress-red.log`, `task2-review-state-red.log`, `task2-review-progress-green.log`.
- `task2-review-full.log`, `task2-review-firefox.log`, `task2-review-webkit.log`, `task2-review-discovery.log`, `task2-review-members.log`.
- `task2-{chromium,firefox,webkit}-metadata-progress.json` and `task2-{chromium,firefox,webkit}-metadata-pending.png` contain the real delayed-request evidence. Existing competition screenshots/metrics were refreshed during the full and cross-engine runs.

Only discovery presentation, its focused regressions and this report changed. The independent reviewer should recheck P2 before Task 2 is accepted. No deployment occurred.
