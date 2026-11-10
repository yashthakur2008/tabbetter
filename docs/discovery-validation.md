# Discovery workspace validation

## Reproduce

```sh
npm test
npm run check
npm run validate
# Requires a compatible Playwright installation and its Chromium browser.
# Set TABBETTER_PLAYWRIGHT_MODULE to its absolute package directory if it is
# not resolvable as `playwright` from this checkout.
node scripts/test-discovery-browser.cjs
```

The browser harness starts an ephemeral local server serving the actual compiled
`worker/index.js`. Ordinary scenarios fixture external Tabroom and geocoding
responses and exercise real parsers, routes, embedded assets, DOM events,
downloads and browser permissions. Two deliberate same-origin timing exceptions
exercise race handling: the stale-manual-location test fulfills `/api/locations`
with a synthetic late response, while the interrupted-circuit test gates
`/api/calendar` before continuing to the real worker. These timing scenarios are
not independent end-to-end source/geocoder validation. Ordinary manual place
search, including the denied-permission fallback, still uses the real worker
and geocoder adapter with external fixtures. Fixture tournaments are not real
public data.
Optional `TABBETTER_SCREENSHOT_DIR` writes desktop, mobile and dark screenshots.
Do not weaken production CSP to accommodate an old browser driver.

Use `--denial-only` on the browser command for the focused denial scenario.
It explicitly denies geolocation, asserts Permissions API state `denied`, waits
for the terminal fallback (not permission-pending text), then searches and selects
a manual city to enable distance controls. Adding `--pending-location-probe`
stubs only the geolocation callback to remain unresolved. That negative-control
run is expected to exit 1 on the terminal-message timeout, proving pending
permission cannot pass. The normal run does not stub browser geolocation.

## Checked workflows

- One homepage search, speech/debate ANY/ALL selection, event-match ranking,
  regional events retained across cached remounts, and real circuit API changes.
- Explicit unavailable metadata and incomplete-coverage wording. Unit integration
  checks pass HTTP-200 unavailable items from the compiled API into the actual UI,
  then recover in explicit batches of at most 12 after the one-minute negative
  cache lifetime. No expiry-driven crawl is introduced.
- Optional manual city candidates, geolocation allowed/denied, approximate
  distance/radius, separate online results and no stored browser location.
- Cleared location rejects late responses. Interrupted circuit requests followed
  by navigation cannot show or export the previous calendar under new filters.
- Filtered CSV download, bookmark persistence, ordinary tournament links,
  preview/Escape/return focus, modal Tab wrapping and search keyboard shortcut.
- Back navigation, widths 320/390/768/1440 including expanded filters, reduced
  motion, fresh light default on a dark OS and persisted optional dark theme.

## Observed evidence, 2026-11-10 UTC

The original implementation recorded 285 Node tests. The final fix wave passed
288 Node tests, the full compiled-browser command, repository checks, generated
artifact validation and `git diff --check`. Added regressions cover actual saved
serialization/reload, legacy-date reconciliation, and API-to-UI unavailable
recovery. The original compiled-browser denial claim is superseded by the explicit
denial scenario and unresolved-callback negative control described above.
Desktop/mobile/light/dark screenshots were inspected for hierarchy, wrapping and
readability. This is implementation QA, not a claim of user aesthetic approval.

Separate read-only live smoke requests through the compiled worker returned:

- Calendar: HTTP 200, 257 tournaments.
- Discovery for 38061 and 41209: HTTP 200, six and eight published source events,
  respectively, published circuit labels and explicitly approximate city points.
- Manual San Jose, CA query: HTTP 200, San Jose/California/United States candidate.
- Live homepage: 257 listed, 12 checked, 11 with published details, 24 rendered
  rows and no observed browser runtime errors.

These are timestamped observations, not ongoing uptime or completeness promises.

## Deliberate limits

New bookmarks retain source sort dates. Legacy bookmarks use dates from matching
current calendar IDs without mutating stored records. A legacy bookmark absent
from that calendar and lacking a source sort key remains date-unknown, rather
than inventing a year from display text, and sorts after known dates.

Metadata checks are bounded batches, not a complete calendar index. Filters only
confirm checked published offerings. Unavailable events, affiliations and city
coordinates are never inferred from names. The optional competitor corpus is
Lincoln-Douglas-only, not a comprehensive people database. Location is memory-only
and clears on route departure. Typed city queries disclose Open-Meteo/GeoNames;
see [discovery-data.md](discovery-data.md) for provider and deployment constraints.

This branch does not implement account login, verify ownership of public records,
collect credentials, or access private paradigms. Identity work remains a separate
draft. Publication uses review branches and PRs, not deployment or main merges.
