# Tournament intelligence: approved design

Approved in conversation on 2026-10-28, including the supplied LeetCode profile screenshot as a layout reference. This records that approval and separates implementation into independently testable live-sync and historical-profile deliverables.

## Goal
Make TabBetter useful during tournaments without manual record uploads, and make published competitor performance understandable through event-specific historical profiles and attributable rankings.

## Existing constraints
- Node.js 22 or newer.
- Preserve the dependency-free runtime and the embedded Cloudflare Worker build.
- Read public, published sources only. No private ballots, account scraping, unpublished results, or guessed identities.
- Preserve existing tournament member routes, publication filtering, filters, source links, accessibility and responsive behavior.
- Preserve preexisting uncommitted redesign changes in web/app.js, web/index.html, web/styles.css and tests/redesign.test.mjs.
- No deployment, paid provisioning, or unrelated repository changes as part of planning.

## Deliverable 1: automatic tournament sync
Existing public exports have a five-minute cache. Automatically refresh the visible tournament at a cache-aligned cadence, pause hidden tabs, and recheck on visibility restoration when due. Prevent overlapping requests and reject obsolete responses after route/tournament changes. Keep the last successful display during transient failures and label stale data, last retrieval time and refresh status honestly. Initial loads must not claim new changes. Later loads identify meaningful published pairing, location, judge and result changes without deriving match outcomes from incomplete ballots. Keep manual refresh as an optional action, not a required upload workflow. Respect upstream rate limits with bounded backoff.

This is polling of public information, not a claim of instantaneous updates or full authenticated Tabroom parity. Reuse shared server caching rather than causing an upstream fetch per viewer.

## Deliverable 2: historical data and ratings
Target source dates are inclusively 2021-10-28 through 2026-10-28. Discover and validate actual archives before claiming five-year coverage. Imports are bounded, resumable, deduplicated and attributable. Record source URL, publication date when known, retrieval time, event, season, methodology and identity scope. Missing seasons or events remain explicit coverage gaps.

Maintain separate identities for people, tournament entries and teams. Link people only through verified stable source identifiers or reviewed mappings. Never merge names alone, assign team Elo to individuals, infer state from an ambiguous school name, or convert missing results to losses. Unknown or withheld names stay withheld.

External ranking snapshots remain labeled by provider and methodology. NSDA participation points are not competitive Elo. TabBetter-derived ratings are separately labeled and computed only for event formats and outcome data for which the method is valid. Current standings use a disclosed active-season cohort. Historical views retain their own date/cohort. No aggregate cross-event competitive ranking. State standings require verified state metadata. Insufficient evidence yields no rating or a clearly disclosed provisional state, not a fabricated percentile.

Published speaker scores retain scoring scale and tournament context. Cross-tournament comparisons use valid within-context normalization rather than averaging incompatible scales. Aff/neg analysis displays sample size and unknown-side/outcome exclusions. Do not infer complete panel results from partial ballot exports.

## Deliverable 3: profile interface
Use the screenshot's information hierarchy, not LeetCode branding:
- Left profile rail: published competitor identity, school, event selector and data-coverage context.
- Top wide card: event-specific rating history, dated national/state standing, tournaments attended, and percentile/distribution only when a valid cohort exists.
- Performance cards: wins/losses only where resolved, speaker trends, side splits and opponent comparisons. Otherwise label published votes or placements accurately.
- Year-selectable activity heatmap driven by real tournament dates, not invented practice activity.
- Recent tournament/results table with source links and season filters.
- Attribution, last update and missing-data explanations remain visible.

Neutral charcoal cards, restrained chart accents, readable typography, keyboard-accessible controls, textual alternatives to charts, and mobile stacking preserve the approved dashboard direction. Existing tournament links should lead to global individual profiles only when identity is verified; tournament-scoped member records remain the safe fallback.

## Architecture and rollout
Separate source adapters, identity resolution, normalized historical storage, rating calculations and profile rendering. Live tournament polling remains independent of historical ingestion. A historical corpus cannot rely on per-instance memory cache as durable storage. Storage and scheduler choices must be investigated and selected through the integration catalog before introducing an external service. Any permission, license, archive or provisioning limitation is reported as a blocker, not replaced with synthetic production data.

Roll out live sync first, then validated source ingestion and profile views. Tests may use clearly labeled synthetic fixtures but acceptance checks must also inspect representative public source responses. Building a profile shell is not completion of the requested historical backfill.

## Acceptance evidence
- Fake-clock and route tests demonstrate visibility pause/resume, no overlap, stale-response rejection, retry behavior and filter preservation.
- Runtime tests demonstrate cache reuse and honest stale timestamps.
- Source/identity tests demonstrate publication boundaries, date cutoff, deduplication, event/team isolation and ambiguous-match rejection.
- Rating tests demonstrate known outcomes, exclusions, cohort/season boundaries, ties, normalization and insufficient-data states.
- Rendered UI checks demonstrate the reference layout hierarchy, empty/error states, safe escaping, mobile behavior and accessible charts/controls.
- Full npm test, npm run check and npm run validate pass before implementation completion is claimed.
- Five-year backfill claims require an observed coverage report by source, event and season, including gaps.
