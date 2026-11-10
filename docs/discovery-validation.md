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
`worker/index.js`. Only external Tabroom and geocoding responses are fixtures.
It exercises real parsers, routes, embedded assets, DOM events, downloads and
browser permissions. It does not claim fixture tournaments are real public data.
Optional `TABBETTER_SCREENSHOT_DIR` writes desktop, mobile and dark screenshots.
Do not weaken production CSP to accommodate an old browser driver.

## Checked workflows

- One homepage search, speech/debate ANY/ALL selection, event-match ranking,
  regional events retained across cached remounts, and real circuit API changes.
- Explicit unavailable metadata and incomplete-coverage wording.
- Optional manual city candidates, geolocation allowed/denied, approximate
  distance/radius, separate online results and no stored browser location.
- Cleared location rejects late responses. Interrupted circuit requests followed
  by navigation cannot show or export the previous calendar under new filters.
- Filtered CSV download, bookmark persistence, ordinary tournament links,
  preview/Escape/return focus, modal Tab wrapping and search keyboard shortcut.
- Back navigation, widths 320/390/768/1440 including expanded filters, reduced
  motion, fresh light default on a dark OS and persisted optional dark theme.

## Observed evidence, 2026-11-10 UTC

At the reviewed implementation, 285 Node tests, repository checks and generated
artifact validation passed. The compiled-browser scenarios above passed.
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

Metadata checks are bounded batches, not a complete calendar index. Filters only
confirm checked published offerings. Unavailable events, affiliations and city
coordinates are never inferred from names. The optional competitor corpus is
Lincoln-Douglas-only, not a comprehensive people database. Location is memory-only
and clears on route departure. Typed city queries disclose Open-Meteo/GeoNames;
see [discovery-data.md](discovery-data.md) for provider and deployment constraints.

This branch does not implement account login, verify ownership of public records,
collect credentials, or access private paradigms. Identity work remains a separate
draft. Publication uses review branches and PRs, not deployment or main merges.
