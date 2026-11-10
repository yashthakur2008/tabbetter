# Discovery data contracts

This slice is public, read-only, partial discovery. It does not authenticate users, fetch private records, match usernames, infer circuit membership from titles, or build a full-calendar index.

## Pure browser/worker API

`src/discovery.mjs` exports:

- `DISCOVERY_EVENTS`: `{id,label,group,aliases}[]`. Groups are `speech` and `debate`. IDs: `di`, `duo`, `hi`, `poi`, `prose`, `poetry`, `storytelling`, `commentary`, `declamation`, `expository`, `ix`, `usx`, `extemp`, `impromptu`, `info`, `oo`, `osw`, `bq`, `congress`, `extemp-debate`, `ld`, `policy`, `pf`, `ws`, `parli`.
- `classifyEvents(events)`: distinct `{id,label,group,sourceLabel}[]`. Accepts published strings or objects with `name` (or already-classified `sourceLabel`). Known division prefixes are stripped only for matching. Unknown labels survive as `other:<lowercase normalized source label>` with group `other`. Extemp speech, domestic extemp, international extemp and extemp debate remain separate.
- `distanceKm(a,b)`: Haversine kilometers for numeric, finite `{latitude,longitude}` within bounds, otherwise `null`. Zero is a valid distance. No network, storage or browser access.
- `discoverTournaments(tournaments, metadata, options)`: copied tournament summaries, each with `discovery: {events,distanceKm,eventMatches,metadataStatus,circuitLabels}`. Metadata is keyed by tournament ID, not the HTTP `items` array. Convert with `Object.fromEntries(payload.items.map(item => [item.id,item]))`.

Options: `{query,eventIds,eventMatch:'any'|'all',origin,radiusKm,includeOnline,sort:'date'|'distance'|'matches'|'name'}`. Defaults: blank query, no event selection, ANY matching, no radius/origin, include online, date sort. Queries match published summary name/city/location/state/country. Event matches count distinct selected categories. Unknown metadata stays visible without an event/radius filter, but cannot satisfy selected events or a strict radius. Missing metadata status is `unknown`. Radius is inclusive, in kilometers, and requires known distance. An explicit zero radius works. Online-only means `modes:['Online']` without in-person/hybrid, never has geographic distance, and is optionally retained in a separate last group when an origin is active. Hybrid can use its published city. Distance-unknown physical results sort last among physical results. Ties resolve by date, name, then ID. No mutation of source summaries.

## GET /api/discovery?ids=38061,37582

Accepts 1–12 comma-separated positive decimal IDs, each at most eight digits. Duplicate IDs are coalesced. Missing/repeated `ids`, malformed IDs, more than 12 input IDs or additional parameters return 400 before any network request. GET only.

Response: `{items:[{id,events,status,coordinates,circuits,sourceUrl,fetchedAt}],partial:true}`.

- `events`: published event objects `{id,name}` or the existing normalizer's `{id,name,abbr,type,category}`. Use `classifyEvents` for category IDs. Never classify tournament titles.
- `status`: `available` when event offerings were actually found, otherwise `unavailable`. `events:[]` with unavailable never means no speech/debate offerings. An empty unrecognized page/export is not asserted to be a known-empty offering list.
- `coordinates`: `null` or `{latitude,longitude,approximate:true,label,attribution:'Open-Meteo / GeoNames'}`. These are city centroids, not venues. Distances are approximate straight-line distance, not travel distance.
- `circuits`: `{id,label,sourceUrl}[]` from published Tabroom circuit links. Empty means no affiliation evidence retrieved, not proof of no membership. Circuit calendar filtering still uses the existing calendar endpoint and published IDs.
- `sourceUrl`: source for event offerings. Each circuit has separate provenance. `fetchedAt`: ISO timestamp of enrichment attempt, retained on cache hits.
- `partial:true` is always present. This is visible-batch enrichment, not exhaustive search coverage.

For each uncached ID, try the matching public export through the existing `normalizeExport`, then the real public `/index/tourn/events.mhtml?tourn_id=...` page. That page exposes event links before registration/export availability and published circuit links. Export events are preserved if the page fails. No registration roster, school list, result-based inference or individual event-page crawl is used. Page script/comment content and links for other tournament IDs are ignored.

City geocoding uses only explicit export city/state/country or the published event-page city/state/country heading. It never uses school/venue names. Online/virtual/timezone/unspecified strings are skipped. Automatic coordinates require exactly one returned populated-place (`PPL*`) candidate with exact normalized city name and compatible published region/country. US state abbreviations map to full state names. Ambiguous, missing-feature, airport/hill, mismatched or failed matches produce null. Region abbreviations outside the US are not guessed.

## GET /api/locations?q=San%20Jose%2C%20CA

Explicit manual search only. The UI must disclose the provider before sending typed text. The route accepts a 2–100 character trimmed city/postal search, with safe letters/numbers and ordinary place punctuation. URLs, coordinate pairs, unknown parameters and repeated `q` are rejected with 400. Browser position must never be sent here.

Response: `{results:[{id,label,latitude,longitude}],attribution:'Open-Meteo / GeoNames'}`. At most five validated candidates, which the visitor must choose from. Unlike automatic city matching, manual candidates need not be exact city names. Empty results are a successful empty search. Malformed provider shape/labels/coordinates, timeouts, queue limits and upstream errors become a controlled 502 with `unavailable:true`, never upstream exception details.

Recognized query forms: `city`, `postal`, `city, region`, `city, XX`, `city, region, XX`, where XX is a two-letter country code. Two-letter US state abbreviations take precedence in the second field (`CA` means California). For Canada use e.g. `Toronto, Ontario, CA`. Region filters compare the returned admin1 name. The adapter requests the city/postal portion as `name`, not the entire comma-qualified string.

All upstream geocoding requests target only `https://geocoding-api.open-meteo.com/v1/search` with `name`, `count=5`, `language=en`, `format=json`, and `countryCode` when known. Redirects are rejected. Attribution is Open-Meteo / GeoNames. See https://open-meteo.com/en/docs/geocoding-api and https://open-meteo.com/en/terms for current service terms. The coordinator selected keyless noncommercial/nonprofit use. No signup, payment, key or account was created. Provider free-use limits currently include 600 calls/minute, 5,000/hour and 10,000/day, and do not constitute an availability guarantee. Commercial use needs separate terms.

## Bounds, cache and privacy

One lazy API instance per worker isolate shares a maximum of three active upstream requests across discovery and manual geocoding, with at most 48 waiting jobs and 48 pending tournament enrichments. Each request has an 8-second abort timeout. Response body caps: export 12 MB, public page 1 MB, geocoder 100 KB, enforced while reading streams. Each uncached tournament uses at most two Tabroom requests and one geocoder request.

Public metadata uses a 200-entry bounded isolate cache: available 10 minutes, unavailable 1 minute. HTTP discovery responses have public max-age 60 seconds. Exact public city lookup results (including ambiguity) cache for 24 hours in a separate 200-entry cache. Concurrent identical tournament/place requests coalesce. Manual location results are never stored after completion and responses use `Cache-Control: no-store`. Only in-flight typed searches exist briefly for coalescing. No visitor position, user cookies or credentials are forwarded or persisted. The typed place is sent to Open-Meteo, whose terms disclose technical request logging retained for up to 90 days. Deployment access logs may also include the manual query URL and need an appropriate retention policy.

The geocoder has additional per-isolate limits of 60 actual upstream calls/minute and 5,000/day shared by manual and event-city lookups. These are defense-in-depth bounds, not a distributed global quota: production scale requires deployment-level aggregate rate limiting to guarantee provider account/IP quotas. Never automatically crawl the full calendar from a visit. Only enrich visible batches of at most 12.

## Compiler

The compiler embeds pure discovery in its own script before the unchanged legacy app script marker. API helpers are embedded before server handlers. Optional `web/discovery.js` is embedded after app.js and optional `web/discovery.css` after legacy CSS. Missing new browser assets are a supported build state. All browser-embedded scripts and styles are checked for closing-tag breakout sequences. Frontend integration and fallback behavior remain the frontend owner's task.
