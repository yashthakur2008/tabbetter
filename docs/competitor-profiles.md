# Competitor profiles and rankings

Profiles answer what a competitor has actually done in one event, using
published results only. See [rankings sources](rankings-sources.md) for
provenance, coverage and redistribution status.

## Rankings view

`#rankings/<EVENT>` lists a ranked season with event, season and search
controls. Omitting the season resolves to the latest imported season on the
server, so no link pins a year that will go stale. Each row links to that
competitor's profile.

## Profile

`#competitor/<EVENT>/<SEASON>/<CODE>` shows the entry identity, current rating,
national rank, field size and standing, a multi-season rating trend, and a
rating-by-season table. Every chart has a readable table beside it. Attribution,
methodology and retrieval time stay on the page.

## Identity rules

School entry codes are reused. In the imported LD data, 148 of 5204 codes belong
to more than one competitor across seasons: `Strake Jesuit  JW` is Justin Wen
through 2024-2025 and Jeffery Wei in 2025-2026. A season joins a history only
when the published name matches, and a reused code is disclosed on the profile
rather than silently merged.

A Public Forum entry is a team. It is shown as a team entry and is never split
into individuals or presented as one person's rating.

## Honest gaps

- A percentile appears only when the size of the ranked field is known.
- A missing rating or rank reads "Not published" rather than zero.
- Events outside LD and PF report that they are not covered.
- A build without the corpus reports that historical rankings are unavailable.

## Validation

`tests/rankings-parse.test.mjs`, `rankings-identity.test.mjs`,
`rankings-stats.test.mjs`, `rankings-corpus.test.mjs`, `rankings-route.test.mjs`
and `rankings-profile.test.mjs` cover parsing, identity, statistics, windowing,
API validation and rendered DOM. Parsers were validated against 1056 real
ranking rows, 208 real entries and 614 real rounds. The rankings view and
profile navigation were verified in a browser against the imported corpus.
