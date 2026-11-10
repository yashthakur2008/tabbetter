# Competitor profiles and rankings implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Event-specific competitor profiles with sourced national rankings, rating history, side splits and speaker trends, covering 2021-10-28 through 2026-10-28.

**Architecture:** A build-time importer converts the public DebateDrills x NSD x DebateLand archive into a compact JSON corpus embedded in the Worker bundle. Pure modules handle parsing, identity, statistics and rendering. Nothing is fetched from a third party at request time.

**Spec:** `docs/superpowers/specs/2026-10-28-tournament-intelligence.md`

## Verified source facts (checked 2026-10-28)
- Repository: `https://github.com/skumar-ml/debate-rankings` (mirror `debate/debate-rankings-archive`). README: "NSD x DebateDrills x DebateLand elo-rankings (2021-2024)".
- Season directories exist for `2021-2022` through `2026-2027`, covering the requested window.
- Older seasons: `<season>/LD_Rankings/LDRankings.csv` with headerless rows `rank,code,debater,elo,flag` (for example `1,Strake Jesuit  ZD,Zion Dixon,2600.377,N`), plus `Rankings_top500.csv` and per-tournament directories. PF lives in `<season>/PF_Rankings/`.
- Newer seasons: `<season>/LD/<Tournament>/` with `entries.csv` (`Institution,Location,Entry,Code,Record`), `Prelims/Tabroom-<id>.csv` and `Elims/`.
- Round CSV header: `Aff,Neg,Judge,Win,"Aff Points","Neg Points"` where `Win` is `Aff` or `Neg`. This supplies side, opponent, judge, outcome and speaker points.
- **No LICENSE file exists** (raw LICENSE returns 404). Treat redistribution as unresolved.

## Global Constraints
- Node.js 22 or newer; no runtime dependencies; embedded Worker bundle.
- Covered events are LD and PF only. Congress and speech are out of scope and must be stated as uncovered.
- Entry codes are team/entry identifiers, never assumed to be one person without a roster name.
- NSDA participation points are never presented as competitive strength.
- Preserve existing tournament routes, member records and accessibility.

---

### Task 0: Source permission gate (blocking)

- [ ] **Step 1:** Email `info@nsdebatecamp.com` requesting redistribution permission and attribution wording; record the request date in `docs/rankings-sources.md`.
- [ ] **Step 2:** Until permission is confirmed, implement against a committed sample fixture only and do not ship a redistributed corpus.
- [ ] **Step 3:** Commit `docs: record rankings source provenance and permission status`.

### Task 1: Archive CSV parsers

**Files:** Create `src/rankings/parse.mjs`; Test `tests/rankings-parse.test.mjs`; Fixtures `tests/fixtures/rankings/`.

**Interfaces:** Produces `parseRankingRows(text)` → `[{ rank, code, name, elo }]`; `parseEntries(text)` → `[{ institution, location, entry, code, record }]`; `parseRoundRows(text)` → `[{ aff, neg, judge, winner, affPoints, negPoints }]`.

- [ ] **Step 1:** Write failing tests using the real shapes above: headerless ranking rows; codes containing double spaces preserved verbatim; quoted multi-space headers in round files; `Win` values mapped to `aff`/`neg` and anything else to `null`; blank or non-numeric speaker points yielding `null`, never `0`; a missing judge yielding `""`; CRLF and trailing-newline tolerance; a malformed row skipped rather than throwing.
- [ ] **Step 2:** Run `node --test tests/rankings-parse.test.mjs`; expect failure.
- [ ] **Step 3:** Implement a quote-aware CSV splitter and the three parsers.
- [ ] **Step 4:** Run the test; expect pass. **Step 5:** Commit `feat: parse public debate ranking archives`.

### Task 2: Identity resolution

**Files:** Create `src/rankings/identity.mjs`; Test `tests/rankings-identity.test.mjs`.

**Interfaces:** Produces `competitorKey({ season, event, code })`, `linkRoster(entries)` → `Map<code, { names: string[], institution, location }>`, `resolvePerson(code, roster)` → `{ status: "resolved"|"ambiguous"|"unknown", name, institution, state }`.

- [ ] **Step 1:** Write failing tests: a one-name LD roster entry resolves; a two-name PF entry returns `ambiguous` and is never split into individuals; the same code in two seasons stays distinct unless the roster name matches; identical names at different institutions never merge; `Location` of `CA/US` yields state `CA` while `TW` yields no state; a missing roster yields `unknown` with no invented school.
- [ ] **Step 2:** Run the test; expect failure.
- [ ] **Step 3:** Implement resolution with no name-only merging.
- [ ] **Step 4:** Run the test; expect pass. **Step 5:** Commit `feat: resolve competitor identity without guessing`.

### Task 3: Performance statistics

**Files:** Create `src/rankings/stats.mjs`; Test `tests/rankings-stats.test.mjs`.

**Interfaces:** Produces `sideSplit(rounds, code)` → `{ aff: { wins, losses }, neg: { wins, losses }, excluded, sampleSize }`; `speakerTrend(rounds, code)` → `[{ tournament, average, rounds, scale }]`; `opponentSummary(rounds, code)` → `[{ opponent, meetings, wins, losses }]`.

- [ ] **Step 1:** Write failing tests: aff and neg records counted from the `Win` column; rounds with a null winner counted in `excluded` and absent from wins and losses; `sampleSize` reflects only counted rounds; a competitor appearing on both sides across rounds aggregated correctly; speaker averages ignoring null points and reporting the contributing round count; averages never computed from zero rounds; opponent counts symmetric and self-matches impossible.
- [ ] **Step 2:** Run the test; expect failure.
- [ ] **Step 3:** Implement the pure statistics functions.
- [ ] **Step 4:** Run the test; expect pass. **Step 5:** Commit `feat: compute side splits and speaker trends`.

### Task 4: Bounded corpus build

**Files:** Create `scripts/import-rankings.mjs`, `src/rankings/corpus.mjs`; Modify `scripts/compile.mjs`; Test `tests/rankings-corpus.test.mjs`.

**Interfaces:** Produces `buildCorpus(files, { from, to })` → `{ generatedAt, window, sources, events, seasons, competitors, coverage }`; `coverageReport(corpus)` → per season and event row counts with explicit gaps.

- [ ] **Step 1:** Write failing tests: seasons outside 2021-10-28 to 2026-10-28 excluded; duplicate code/season rows deduplicated; every competitor record carries `sourceUrl`, `retrievedAt` and `methodology`; a season present on disk but empty reported as a gap rather than omitted; corpus serialises to JSON without functions; the embedded corpus stays under a stated size budget.
- [ ] **Step 2:** Run the test; expect failure.
- [ ] **Step 3:** Implement the importer writing `src/rankings/corpus-data.json`, and embed it in `scripts/compile.mjs` alongside existing assets.
- [ ] **Step 4:** Run `npm test`, `npm run check`, `npm run validate`; expect pass. **Step 5:** Commit `feat: build a bounded sourced rankings corpus`.

### Task 5: Profile route and layout

**Files:** Modify `web/app.js`, `web/styles.css`; Test `tests/rankings-profile.test.mjs`.

**Interfaces:** Consumes Tasks 1-4. Produces route `#competitor/<event>/<season>/<code>` and `renderCompetitorProfile(key)`.

- [ ] **Step 1:** Write failing tests asserting rendered DOM: sidebar with name, institution, event and season selectors; a rating card showing Elo, national rank and attribution naming DebateDrills x NSD x DebateLand; a rating-history series; side-split and speaker cards showing sample size; a results table with tournament links; an ambiguous identity rendering an explicit notice and no individual rating; an uncovered event rendering "not covered by this source"; percentile omitted when the cohort is unknown; all names escaped; no NSDA points shown as Elo.
- [ ] **Step 2:** Run the test; expect failure.
- [ ] **Step 3:** Implement the route, renderer and charcoal card styles matching the approved dashboard direction, with text equivalents for every chart.
- [ ] **Step 4:** Run `npm test`, then verify in a browser against the dev server. **Step 5:** Commit `feat: add event-specific competitor profiles`.

### Task 6: Linking and documentation

**Files:** Modify `web/app.js`, `docs/architecture.md`, `README.md`; Create `docs/competitor-profiles.md`; Test `tests/rankings-profile.test.mjs`.

- [ ] **Step 1:** Write a failing test that a tournament entry links to a profile only when identity is `resolved`, and otherwise keeps the existing tournament-scoped member record.
- [ ] **Step 2:** Run the test; expect failure. **Step 3:** Implement conditional linking.
- [ ] **Step 4:** Document sources, methodology, covered events, coverage gaps and limits; run `npm test`, `npm run check`, `npm run validate`.
- [ ] **Step 5:** Commit `feat: link verified competitors to profiles`.
