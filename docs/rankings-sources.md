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

## Sources

| Source | Events | Season | Link |
| --- | --- | --- | --- |
| NSDA National Tournament results packet | 18 speech and debate events | 2025-2026 | [Packet](https://s3.amazonaws.com/tabroom-files/tourns/37602/results/70808/2026-NationalSpeechAndDebateTournament-ResultsPacketv2.pdf) · [Tabroom](https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=37602) |
| NSD x DebateDrills x DebateLand archive | Lincoln-Douglas, Public Forum | 2025-2026 | [Archive](https://github.com/skumar-ml/debate-rankings) |
| National Parliamentary Debate League | Parliamentary | current season | [Rankings](https://www.parliamentarydebate.org/rankings-2026-27) |

[NSDA member rankings](https://www.speechanddebate.org/rankings/) are
participation points behind a member login, not competitive placement, and are
deliberately not imported or shown as a rating.

Each ranking names the tournament it came from and links to both the official
results and the Tabroom tournament page.

## Observed coverage

The default import window is **2025-08-01 through 2026-07-31** (2025-2026).
The importer never expands it to accommodate a newer source. In particular, the
linked NPDL 2026-2027 table is excluded from this default import, not relabeled
as 2025-2026. Other seasons require explicit bounds, for example:

```sh
node scripts/import-rankings.mjs --from=2023-08-01 --to=2027-07-31
```

Only source seasons overlapping the requested window are fetched. Season-level
snapshots are not filtered by individual tournament date.

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
