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

`#competitor/<EVENT>/<SEASON>/<CODE>` shows the entry identity, published metric,
source rank or tournament place, and imported entry count. Elo records use
"Rating", NPDL season points use "Points", and official placements name their
tournament instead of inventing a rating. Rating histories have a readable
table and a trend only when all displayed values are finite ratings.
Record-level attribution and methodology take precedence over the cohort's
defaults. Tournament links are shown when provided by that record.

## Identity rules

School entry codes are reused. In the imported LD data, 148 of 5204 codes belong
to more than one competitor across seasons: `Strake Jesuit  JW` is Justin Wen
through 2024-2025 and Jeffery Wei in 2025-2026. A season joins a history only
when the published name matches, and a reused code is disclosed on the profile
rather than silently merged.

A Public Forum entry is a team. It is shown as a team entry and is never split
into individuals or presented as one person's rating.

## Honest gaps

- A competitor absent from a season reads **Unranked** for that season rather
  than being omitted, and the rating, rank and standing cards read Unranked
  rather than borrowing another season's numbers. Unranked means no published
  rating in this source, not a low placement. An entry absent from every
  imported season gets an Unranked empty state that says so.
- Imported entry count is not a published field size. The corpus may contain
  partial results, so no percentile is inferred from that count. Standing reads
  "Not available" unless the requested season is unranked.
- A missing rating reads "Not published" rather than zero.
- Event availability follows the imported corpus. Official speech placements
  and NPDL points remain distinct from LD/PF Elo ratings.
- A build without the corpus reports that historical rankings are unavailable.

## Validation

`tests/rankings-parse.test.mjs`, `rankings-identity.test.mjs`,
`rankings-stats.test.mjs`, `rankings-corpus.test.mjs`, `rankings-route.test.mjs`
and `rankings-profile.test.mjs` cover parsing, identity, statistics, windowing,
API validation and rendered DOM. Parsers were validated against 1056 real
ranking rows, 208 real entries and 614 real rounds. The rankings view and
profile navigation were verified in a browser against the imported corpus.
