# Rankings sources and provenance

## Source

Historical LD and Public Forum ratings come from the public archive published at
<https://github.com/skumar-ml/debate-rankings> (mirrored at
`debate/debate-rankings-archive`), described by its README as "NSD x DebateDrills
x DebateLand elo-rankings". The companion leaderboard is published at
<https://www.debatedrills.com/rankings>, which states that its Elo awards points
by opposing strength, adds an elimination-round bonus scaled to tournament size,
and weights larger tournaments more heavily.

Verified on 2026-10-28: season directories `2021-2022` through `2026-2027`
exist. Older seasons store `<season>/<EVENT>_Rankings/` CSVs; newer seasons store
`<season>/<EVENT>/<Tournament>/` with `entries.csv`, `Prelims/` and `Elims/`.
Round files carry `Aff,Neg,Judge,Win,"Aff Points","Neg Points"`.

## Observed coverage

Imported with `node scripts/import-rankings.mjs` for the window 2021-10-28 to
2026-10-28, which produced 19,761 competitor-season records:

| Season | LD | PF |
| --- | --- | --- |
| 2021-2022 | 1046 | 1693 |
| 2022-2023 | 1155 | 2044 |
| 2023-2024 | 1424 | 2479 |
| 2024-2025 | 1577 | 2670 |
| 2025-2026 | 1524 | 2433 |
| 2026-2027 | 710 | 1006 |

Counts are below the raw row totals because duplicate entries across the full and
top-500 exports are deduplicated by best published rank.

## Limits

- Only Lincoln-Douglas and Public Forum are covered. Congress, speech and other
  events are not in this source and are reported as uncovered rather than blank.
- Entry codes identify a tournament entry. A Public Forum entry is a team, so it
  is never split into individual competitors or shown as one person's rating.
- NSDA points at <https://www.speechanddebate.org/rankings/> measure
  participation, not competitive strength, and are never displayed as Elo.
- State is read only from an explicit `<STATE>/US` location. A bare `CA` is
  ambiguous between California and Canada in this data and yields no state.
- Ratings are the source project's, not TabBetter's. Attribution and retrieval
  time travel with every record.

## Redistribution status

**Unresolved.** The archive publishes no LICENSE file (a raw `LICENSE` request
returns 404), and the README directs questions to `info@nsdebatecamp.com`.

Until written permission is recorded here, the generated corpus is written to
`build/` which is git-ignored, and is never committed. `scripts/compile.mjs`
embeds `build/rankings-corpus.json` only when it exists; otherwise the Worker is
built with `rankingsCorpus = null` and `/api/rankings` honestly reports that
historical rankings are not included in that build.

Permission requested: not yet sent. Record the request date and the response
here before shipping a build that embeds the corpus.
