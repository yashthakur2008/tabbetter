# TabBetter discovery workspace

Date: 2026-11-10
Status: proposed, awaiting review before implementation

## Goal and scope

Replace the disliked homepage with a polished, spacious discovery workspace. Speech and debate receive equal prominence. Let visitors combine event offerings, published circuit affiliation, and location to find suitable tournaments. Preserve tournament/member routes, saved items, publication warnings and source attribution. This is not an account/login implementation, a rankings expansion, or a claim of comprehensive 2023–27 coverage.

## Reference direction

- Raycast: command-oriented search, keyboard access, direct actions.
- Linear: coherent hierarchy, restrained surfaces, predictable interaction and detail panels.
- Awwwards Lusion Labs: responsive interaction and distinctive composition. Its award listing documents mouse interaction and theme transitions: https://www.awwwards.com/sites/lusion-labs . Use as inspiration, not a copied layout or justification for loading screens/WebGL.
- User preferences override references: light-first, spacious, organized, consistent theme, minimal clutter, no decorative divider lines. The rejected dark/glow treatment is not the default direction.

Alternatives considered: a cinematic landing page would bury the directory; another CSS overlay would preserve the duplicate searches and generic tiles. Choose a discovery-led workspace with purposeful transitions.

## Page and visual hierarchy

1. Compact brand/navigation with explicit current section and one global search affordance.
2. Short heading such as “Find your next stage.” with a concise explanation covering both speech and debate. No oversized marketing hero or decorative statistics tiles.
3. One visible search field for tournament, city, school and available competitor results. Group different result types visibly; unavailable competitor data must not break tournament search. Cmd/Ctrl+K focuses the search, Escape dismisses suggestions, and existing typed input shortcuts are preserved.
4. Filter rail: event selection, circuit, location and distance. Active filters become removable chips; clear-all is always reachable. Advanced existing controls remain in an accessible More filters disclosure.
5. Result summary and sort selection, followed by generous borderless tournament cards/list rows. Show name, dates, city/online status, published events, circuit tags, registration status, save action and an expandable preview. Event overflow uses “+N more” rather than hiding information permanently.
6. Preview opens on explicit activation, not hover-only. Desktop uses an accessible detail panel; mobile uses a full-width sheet with visible close control. Keep an ordinary tournament link usable without the preview.

Use off-white canvas, dark legible type, subtle surface changes, one restrained accent and consistent iconography. Separate groups with whitespace, not lines. Keep theme preference available, but do not force a new dark theme. Rework the existing style source rather than adding another long conflicting override layer.

## Event and circuit semantics

Taxonomy reference: https://www.speechanddebate.org/competition-events/ (read 2026-11-10).

Speech interpretation: Dramatic, Duo, Humorous, Program Oral Interpretation, Prose, Poetry and Storytelling.
Speech public address: Commentary, Declamation, Expository, Extemporaneous Speaking, Impromptu, Informative, Original Oratory and Original Spoken Word Poetry.
Debate: Big Questions, Congressional, Extemporaneous Debate, Lincoln–Douglas, Policy, Public Forum and World Schools.
Preserve domestic/international extemp distinctions when published; preserve Parliamentary and other regional events rather than forcing them into an NSDA label.

Use explicit offered-event names from public tournament data, not tournament-title guesses or competitor results. Normalize known aliases conservatively and retain original source labels. Unknown/unavailable offerings are “Events not published,” not “No speech events.” Multi-event selection defaults to ANY selected event; provide an explicit ALL switch. Circuit affiliation is a separate filter backed by published circuit IDs. Do not equate TOC bids with circuit membership or imply affiliation without evidence.

Sorting: date, nearest first, and preferred-event matches first. Match rank is the count of distinct selected offered-event categories, with date/name/ID tie-breaks. Without selected events, the event sort prompts selection instead of pretending to personalize. No paid/sponsored ranking or fabricated popularity.

## Location and privacy

A “Find near me” action offers browser location permission only after a click, plus manual city/postal-code entry. Explain that manual geocoding sends the typed place to a location service before making that request. Provider selection/setup remains a separate implementation prerequisite, not implicit permission to create a paid account.

Use coarse location for discovery. Compute distances in the browser from event coordinates where available; do not transmit precise visitor coordinates for analytics or silently persist them. Clearing location removes any session location. Display approximate straight-line distance, not driving time. City-centroid coordinates must be labelled approximate; no coordinates means “Distance unavailable.”

Radius choices: 25, 50, 100, 250 miles and any distance, with consistent unit conversion if kilometers are chosen. Unknown-distance events appear last for distance sort but do not pass a strict radius filter. Online-only events are never “0 miles away”; a separate include-online toggle includes them in a labelled group. Hybrid events may use the published physical venue and retain their hybrid badge. Denied permission, ambiguity, unavailable geocoding and timeouts have actionable manual-entry fallbacks.

## Data and implementation boundaries

Current build embeds web/app.js and web/styles.css into a generated worker through scripts/compile.mjs. Generated worker/dist files are not the source of truth. Calendar summaries lack guaranteed event lists and coordinates, so UI implementation alone cannot truthfully satisfy tagging or distance sort.

Introduce focused discovery data/normalization and browser UI modules, explicitly wired through the compiler. Keep existing route handlers and escaping contracts intact. Use bounded, cached enrichment of public tournament metadata, not hundreds of upstream requests on every homepage view. Separate absent metadata from a known empty list. For the first slice, enrich visible results on demand; event/distance filters must visibly disclose incomplete coverage and cannot claim exhaustive matches across un-enriched tournaments. A full-catalog filter requires a background cached index and measured coverage before it can claim completeness. Avoid inferring missing venues from school names.

Server adapters own source validation, cache TTL/provenance and bounded fetching. Pure discovery functions own taxonomy matching, filtering and deterministic ordering. Browser components own interaction state, accessible rendering and motion. Keep user location out of shared server caches. Preserve stale-data indicators and handle out-of-order responses so earlier searches cannot replace newer results.

## Motion and accessibility

Animate meaningful changes: chip selection, card-to-preview expansion and result reordering. Typical duration 140–240ms, primarily opacity/transform. No scroll hijacking, custom cursor, infinite ambient animation, mandatory intro or 3D dependency. Cancel stale transitions during rapid filtering. Reduced motion removes movement without hiding content. Keyboard/touch users can reach every control without hover. Manage focus and Escape for panels; announce final result counts without announcing each animation frame. Verify text contrast, 44px touch controls where practical, and clear focus indicators.

## Acceptance and PR boundaries

- Publishing existing work is separate from approving this redesign. Existing identity work stays draft and is not described as authentication.
- PR 1 for the new work: source normalization/enrichment and tests, with truthful unknown states and provenance.
- PR 2: the workspace layout, search, filtering, sort and accessible motion, using PR 1 data contracts.
- Keep authentication and judge-paradigm fixes separate.

Tests must cover speech/debate aliases and ambiguous names, ANY/ALL combinations, missing event metadata, circuit IDs, stable sort ties, online/hybrid grouping, distance math, radius edges, missing coordinates, permission denial, stale responses and clear/reset behavior. Browser checks exercise the real built app at 320/390/768/1440px, keyboard navigation, screen-reader names, no horizontal overflow, panels and back navigation, reduced motion and saved-item persistence. Record missing data/geocoder limitations rather than passing them off as completed features. Run the full existing suite and repository checks before commits/PR readiness.

## Review checkpoint

Approve this light-first discovery workspace and the explicit partial-coverage behavior before implementation planning. It intentionally does not promise complete metadata, verified account claims or historical records that are not present in the source.
