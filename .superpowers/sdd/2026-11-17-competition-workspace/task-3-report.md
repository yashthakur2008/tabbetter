# Task 3 implementation and acceptance report

Date: 2026-11-17. Branch: `design/competition-workspace`.

## Source and boundaries

- Starting HEAD: `f9d8370efb1f905faabc6f33a6468ebdc8fedc2c`, the reviewer-docs commit above approved Task 2 production base `ae22574`.
- **Tested implementation commit: `ecee2e0f4a13bd8b6133c2a68e83c36dbe71a7a1`.** Final tests below ran against exactly these production/test files before committing. This report is a subsequent documentation-only commit.
- Read the binding Task 3 brief, approved spec/plan, baseline audit, schedule investigation and final acceptance gate. The brief's explicit no-guessed-timezone ruling supersedes the investigation's earlier separator-only proposal.
- No subagents, branch switches, dependency installation, push, merge, deployment, credentials, login or public upstream mutation. CSP and server security policies are unchanged. Independent coordinator review and release remain required.

## Bugs fixed and implementation

1. **B2, actual Calendar failure:** the old space-only regex rejected all four live offsetless `T` slots. Schedule now validates both separators and explicit `Z`/numeric offsets, resolves instants only with sufficient information, and downloads a real four-event calendar after an explicit interpretation when needed.
2. **B3, viewer-dependent Schedule display:** Schedule no longer calls the generic browser-dependent `formatDate`. Offsetless `T` and space values show their published wall time, with `Timezone not specified in source`. Once selected, the source interpretation produces the same tournament-zone display and export in LA and UTC browser contexts.
3. **Invented timezone metadata:** `normalizeExport` previously defaulted a missing tournament timezone to UTC. It now preserves missing metadata. Invalid/missing tournament zones block calendar export with a specific explanation, without substituting a UTC display zone.
4. **Unsafe/partial exports:** invalid calendar fields, non-increasing ranges, DST gaps and folds block the whole export rather than dropping events or selecting an arbitrary instant. Empty, malformed, unspecified and invalid-timezone states remain distinct.

`web/schedule.js` is a focused 143-line module with parsing, timezone validation/conversion, per-tournament choice, schedule rendering and ICS serialization. `app.js` loses its old Schedule/ICS implementation and only delegates rendering plus tournament-entry reset. The compiler embeds the module before app initialization and includes it in closing-script safety validation. Existing VM sync/standings tests now load the real dependency; their behavioral assertions were not weakened.

### Choice and display contract

- Native labeled **Interpret source times as** selector starts unselected. Options are UTC and the validated published tournament IANA name, with UTC aliases deduplicated.
- The tournament timezone and invitation link are separately visible. Inline persistent status explains that the choice affects both display conversion and calendar export.
- Calendar without a required choice focuses the selector. Nothing downloads. No toast-only failure or automatic choice.
- Choice survives tabs and background Check now refresh within the same tournament. Switching tournaments clears it, including when returning. It is memory-only and resets on reload. No location/sensitive data or new storage key is persisted.
- Explicit-offset-only schedules do not need a choice. Mixed timestamps retain explicit instants while applying the choice only to offsetless values.
- ICS uses matching UTC instants, four unique UIDs for the four-slot source, DTSTAMP/DTSTART/DTEND, official URL, escaped backslash/newline/comma/semicolon text, CRLF including the final line, and UTF-8-aware 75-octet folding.

## Red-first evidence and iteration

- Before production edits, `node --test tests/schedule.test.mjs` failed all six initial cases with the explicit assertion that the focused schedule API was absent. Cases already included the exact four raw slots, separators/offsets/mixed values, calendar/range validity, DST invalidity, escaping and choice lifecycle.
- After the baseline build, the compiled Chromium schedule test failed on missing `Timezone not specified in source`. Its actual DOM contained the old invented PDT labels for all four raw offsetless slots.
- The adapter missing-timezone test initially had an invalid fixture ID, which was corrected. It then failed for the intended reason: actual `UTC` versus expected empty metadata. It passed after removing the default.
- Later red tests caught a fallback UTC display for invalid tournament zones and canonicalization replacing the source's validated IANA alias. Both were corrected and rerun green.
- The first browser run after implementation passed real downloads for both choices, then timed out on my incorrect `#people-search` selector. Corrected to the existing `#detail-search`. A later refresh assertion used the wrong status phrase and was corrected to the actual `Updated …` contract. These were harness errors, not claimed production defects.
- The initial full integration run was 343 pass / 4 fail because old VM harnesses extracted only app.js. Loading the real new module fixed all four, without stubbing it or changing assertions.

## Exact final checks

Installed package only:

```sh
export PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright/index.mjs
export TABBETTER_PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright
npm test
npm run check
npm run validate
for engine in chromium firefox webkit; do
  BROWSER_ENGINE=$engine node --test \
    tests/workspace-browser.test.mjs tests/competition-browser.test.mjs \
    tests/discovery-progress-browser.test.mjs tests/schedule-browser.test.mjs
done
node scripts/test-discovery-browser.cjs
node scripts/test-member-paradigms-browser.cjs --live
node scripts/test-schedule-live.mjs
git diff --check
```

Final evidence root: **`/Users/yashthakur/.jcode/scratch/task3-final/`**.

| Check | Observed result | Evidence |
|---|---|---|
| Full opt-in `npm test`, including build | **351 passed, 0 failed, 0 skipped** | `full.log` |
| Focused schedule unit tests | **10 passed** | Included in full log; direct focused run also passed |
| Chromium relevant compiled browser suites | **7 passed, 0 failed, 0 skipped** | `chromium.log` |
| Firefox same suites | **7 passed, 0 failed, 0 skipped** | `firefox.log` |
| WebKit same suites | **7 passed, 0 failed, 0 skipped** | `webkit.log` |
| Original discovery suite, unchanged | Passed | `discovery.log` |
| Original member suite, unchanged, plus `--live` | Passed, including public original identity and official login redirect | `member.log` |
| Unintercepted compiled public smoke | Passed | `live.log` |
| `npm run check` | Repository hygiene/source syntax passed, rerun after staging new files | Task output, also rechecked at commit |
| `npm run validate` | Artifact valid ESM with default.fetch | Task output, also rechecked at commit |
| `git diff --check`, staged check | Passed | Task output |

### Schedule regression coverage

Supplemental fixture tests exercise the actual compiled Worker, adapters, CSP, DOM controls and browser download bytes, not a replaced download callback. In **each of Chromium, Firefox and WebKit**, fresh **America/Los_Angeles and UTC contexts** compare raw display and both selected interpretations, all four exact DTSTART/DTEND values, UID/DTSTAMP, calendar envelope, CRLF and escaping. They also verify no-choice focus/feedback, same-tournament tab and background-refresh preservation, switch/reset, explicit-only and mixed input, DST gap/fold feedback, malformed/empty/invalid-zone distinctions, UTC option deduplication, extra-large reflow at **320/390/768/1440**, focus after changes and reset on reload.

Unit cases additionally cover leap-day validity, impossible month/day/hour/minute/second/offset values, missing timestamps, reversed/equal ranges, midnight rollover, UTF-8 folding, source timezone aliases, Lord Howe half-hour DST gaps/folds and Samoa's skipped civil date. Unsupported shapes are rejected explicitly rather than parsed permissively.

### Preserved workspace and old workflows

The three-engine existing suites reran tutorial steps and final exact Settings explanation, completion/replay/disable/persistence, settings storage denial/migration, native focus cycles, responsive drawer cleanup, reduced-motion precedence, brand/asset checks, compact directory layout and metadata-progress behavior. The original Chromium discovery harness retained ANY/ALL, circuit/location/radius/online, preview, actual filtered CSV contents, saves/reload, real permission grant/denial and stale-location/back-navigation privacy assertions. The original identity suite retained explicit/missing/invalid/duplicate/conflicting/unmatched IDs and unavailable-source behavior. No raw roster output was saved.

## Actual public acceptance, separate from fixtures

Primary final run began **2026-11-17T20:39:38.613Z**. An earlier separate run began 20:35:55.608Z and also passed. Both used the **local compiled Worker with ordinary upstream fetch**, with **no response interception or fixture substitution**. The four-slot constants imported by the live harness are expected-value assertions only. A source change fails and is reported, never overridden.

Actual `/api/tournament?id=41209&schema=4` returned **HTTP 200**, timezone **America/Los_Angeles**, and exactly:

| Round | Published start | Published end |
|---|---|---|
| 1 | `2026-10-24T15:30:00` | `2026-10-24T17:15:00` |
| 2 | `2026-10-24T17:45:00` | `2026-10-24T19:45:00` |
| 3 | `2026-10-24T20:15:00` | `2026-10-24T22:00:00` |
| 4 | `2026-10-24T22:30:00` | `2026-10-25T00:30:00` |

The real UI initially required a choice and focused the selector on Calendar. Explicitly selecting **UTC** downloaded `tabbetter-41209.ics`, **1008 bytes / 4 VEVENTs**, in both LA and UTC browser contexts:

- Starts: `20261024T153000Z`, `20261024T174500Z`, `20261024T201500Z`, `20261024T223000Z`.
- Ends: `20261024T171500Z`, `20261024T194500Z`, `20261024T220000Z`, `20261025T003000Z`.

Explicitly selecting **America/Los_Angeles** downloaded the same filename, **1008 bytes / 4 VEVENTs**, in both contexts:

- Starts: `20261024T223000Z`, `20261025T004500Z`, `20261025T031500Z`, `20261025T053000Z`.
- Ends: `20261025T001500Z`, `20261025T024500Z`, `20261025T050000Z`, `20261025T073000Z`.

All four download contents were checked against those exact instants, UID uniqueness, DTSTAMP count and CRLF. Raw and selected schedule DOM strings matched between browser zones. These are consequences of the **explicit selected interpretation**, not evidence that either interpretation is upstream truth.

The same unintercepted run exercised Invitation, Events, Entries, Schools, Judges, Pairings, Results, Statistics and Resources. Entry/judge nonsense searches yielded zero rows. Lincoln Douglas JV event/round controls produced published round cards for Pairings and Results. The original judge registration `2898901` linked to official person `881819`, with login-required labeling and working member return. Actual directory data rendered 24 rows, nonsense search cleared them, and a disposable-context bookmark survived Saved navigation and reload.

The original member `--live` run separately verified **271 member links / 267 shortcuts**, missing identity suppression, and **HTTP 302** to the official login page. It did not follow login or inspect authenticated content.

## Presentation observations

All three engines wrote fixture screenshots/metrics under `screenshots/`. Schedule extra-large screenshots at 320 and 1440 are named `schedule-{engine}-{width}.png`. I inspected the narrow Chromium image: the selector, explanatory text, invitation link and raw round times wrap without horizontal overflow. These screenshots are supplemental fixtures, not live-source or user visual approval.

Current compiled **fixture** Chromium directory measurements at default text size:

| Viewport/state | First row top | First title top | Fully visible rows |
|---|---:|---:|---:|
| 1440×1000, fresh welcome | 534.55 | 546.55 | 4 |
| 1440×1000, dismissed | 425.36 | 437.36 | 5 |
| 390×900, fresh welcome | 749.30 | 788.30 | 0, but first title fully readable |
| 390×900, dismissed | 594.11 | 633.11 | 1 |

The baseline audit's **live** mobile first title was 936.33, below the 900px viewport. These are not a same-source before/after experiment: the current harness uses eight fixtures, while baseline used the public listing. Task 2's approved report contains the matched fixture comparison. Fresh welcome and dismissed layouts are explicitly separate. Extra-large text naturally increases vertical height; no claim that every first row fits above the fold at 150% is made. Navigation remains explicit, with desktop sidebar Saved/Settings and tournament Pairings controls, and mobile Menu access tested by the inherited suites.

## Limitations and next release checks

1. **Upstream offset semantics remain unverified.** The source response provides no offset for these slots. Neither invitation comparison nor our tests proves UTC versus local meaning. The explicit user choice is the approved mitigation, not a guessed repair.
2. Parsing is deliberately strict for second-resolution source timestamps with T/space and optional Z/`±HH:mm`. Other shapes fail visibly. Timezone conversion uses browser `Intl` data. Historical/all-IANA exhaustive timezone testing is not claimed.
3. This repair is scoped to **Published schedule and ICS**. The generic date formatter used by unrelated tournament metadata/registration/discovery was not globally reinterpreted. Its older policies are not newly validated by the schedule tests.
4. Live source availability is variable, as the baseline documents. Success here establishes availability during these runs, not continuous completeness. Live directory event-tag coverage and every official external resource were not exhaustively audited. Supplemental fixtures validate missing/partial-source behavior without pretending it is live data.
5. Browser screenshots are headless/narrow-viewport evidence, not actual mobile hardware, browser-tab chrome, screen-reader operation or user design approval. No new comprehensive contrast audit or calendar-client import was performed. Existing branding/theme/accessibility regressions passed.
6. **Independent review is pending with the coordinator.** Review Task 3 from `f9d8370` to `ecee2e0`, and the whole workspace against the approved baseline before release. No subagent reviewer was spawned, per instruction.
7. **Nothing was deployed.** Coordinator must publish only reviewed source, record the prior/new Worker version, verify apex/www assets and real mobile Settings/tutorial/Schedule interactions, recheck public four-slot downloads if available, and distinguish source outages from application failures. No account/login or exhaustive rankings-corpus claim is introduced.
