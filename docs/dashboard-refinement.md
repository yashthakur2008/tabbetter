# Approved dashboard refinement

Approved by the user on 2026-10-26.

## Visual direction

A professional competition workspace, not a decorative landing page. Neutral charcoal dark surfaces and restrained emerald accents. Clear typography, coherent navigation icons, subtle borders, tighter alignment, readable content widths and responsive layouts. Keep result meaning visible through text as well as green/red color. Preserve persisted theme choices and reduced-motion behavior.

## Round navigation

Separate Event and Round controls. Event changes constrain available rounds and clear an incompatible selection. Keep search usable alongside the controls. Results and pairings use the same navigation pattern.

## Published standings

Show Speaker Awards and Prelim Rankings only when supported by published source data. Never reconstruct official rankings from ballots or equate speaker awards with team standings. Preserve other published standings. Numeric ranks 1, 2 and 3 receive gold, silver and bronze accents with visible numeric rank labels. Missing source data is clearly described, not presented as an empty competition.

## Invitation links

Preserve clickable HTTP(S) links within invitation text. Treat all upstream content as untrusted. Structured text/link segments are escaped at rendering and never inject source HTML. Existing plain-text paragraphs remain available for compatibility. Version both edge and browser API cache keys when the response shape changes.

## Acceptance checks

- Parser/render tests cover unsafe links, text escaping, source identifiers, standings publication and award classification.
- Event selection limits round options and displayed sections.
- Theme contrast tests pass. Desktop and narrow-screen layouts are checked in the browser for overflow and usable controls.
- Live invitation links in tournament 41209 retain their source destinations.
- Existing results continue displaying verified sides, published ballot outcomes and person-ID paradigm links.
- Build, complete regression suite and artifact checks pass before deployment.
