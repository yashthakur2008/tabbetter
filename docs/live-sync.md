# Automatic tournament sync

An open tournament keeps itself current from published Tabroom exports. No
record upload, file import or manual export step is required.

## Cadence

The page checks every 15 seconds whether a refresh is due, and refreshes when
the public export cache age of five minutes has elapsed. A hidden tab never
polls; restoring it checks immediately if a refresh is overdue. A refresh never
overlaps another, and the manual "Check now" button remains available.

Failures back off from 30 seconds, doubling to a maximum of the normal five
minute interval, and reset on the first success.

## What a refresh does

A background refresh never blanks the page or resets filters. Responses that
arrive after the user navigates elsewhere are discarded. When a refresh fails,
the last successful render stays on screen and the status line reports that the
data could not be refreshed, with how long ago the last success was.

Meaningful changes to published pairings, rooms, judges and sides are
announced. The first load never announces changes, and outcomes and speaker
points are deliberately excluded from change detection so a published result is
never reported as a schedule change.

## Limits

This is polling of public information, not live tab access. It cannot show
private ballots, unpublished results or anything requiring a Tabroom login, and
it is no fresher than what the tournament publishes. Refreshes are served from
the shared server cache rather than one upstream fetch per viewer.

## Validation

`tests/sync.test.mjs` covers cadence, visibility, overlap, backoff and reset,
pairing fingerprints and change summaries, status wording and escaping, and
behavioural checks that a background refresh preserves the view, keeps the last
good data on failure, and discards responses for an abandoned tournament.
Verified in a browser against tournament 33617: content preserved, timestamp
advanced, no loading flash, route retained.
