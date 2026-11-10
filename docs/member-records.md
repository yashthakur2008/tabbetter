# Tournament member records

Entry and judge names in directories and published round cards link to read-only records inside the current tournament. Opponents and judges in record tables are linked as well.

## Organization

- Tournament name and scope appear in the record header.
- Events have separate sections, captions, and vote summaries. There is no combined cross-tournament record or cross-event win total.
- Entry tables align round, room/flight, side, opponent, judge, and published vote.
- Judge tables keep each decision next to its entry rather than in a detached list of outcome badges.
- Registered members without exported ballots retain their identity and receive an explicit empty state.
- Tables use column/row headers and keyboard-focusable horizontal scroll regions on smaller screens. Links have persistent underlines and visible focus outlines.

## Identity and publication limits

Entries use tournament entry IDs. Judge registration IDs are preferred; an explicitly published person ID is used only when no registration ID is present. Names alone never link judge records or attach school metadata. A team entry is not split into guessed individual profiles.

All lookups operate on the loaded tournament, not a global name cache. Switching tournaments cannot retain another tournament's record, even if an ID is repeated. URL segments are escaped and malformed bookmarks fail safely.

Vote summaries are not official match records. Byes remain visible but do not contribute wins. Missing and duplicate decisions are unresolved rather than losses. Published panel ballots may be incomplete. Private feedback and complete judging obligations are not available here.

## Validation

`npm test` covers member routes, links from round cards and directories, identity collisions, tournament isolation, event separation, panels, missing outcomes, byes, duplicate decisions, escaping, and style hooks. Run `npm run check` and `npm run validate` for syntax/repository and compiled-artifact checks.
