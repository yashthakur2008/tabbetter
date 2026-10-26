# Published standings and round filters

## Verified upstream evidence

Checked 2026-10-26 against official `speechanddebate/tabroom` commit `c350e25c20d3cb442d6ff554907c493355ab52d9`, using the public source via `webfetch` and a targeted read of the same file:

- [Public export implementation](https://github.com/speechanddebate/tabroom/blob/c350e25c20d3cb442d6ff554907c493355ab52d9/web/api/download_data.mhtml#L1800-L1900): public exports skip result sets unless `published == 1`. Sets export `label`, `tag`, `entity`, and other metadata. Individual rows export `rank`, `place`, `entry`, `student`, `school`, and `round`. The containing event supplies event identity. Public school-entry students provide names only when included by the upstream export.
- [Official result generation](https://github.com/speechanddebate/tabroom/blob/c350e25c20d3cb442d6ff554907c493355ab52d9/web/tabbing/publish/generate_results.mhtml): `speakers` produces tag `speaker` and label `Speaker Awards`. `prelim_seed` produces tag `seed` and label `Prelim Seeds`. Those two explicit tags support the Speaker Awards and Prelim Rankings groups. Original source labels remain visible beneath each group.
- The same generator stores `prelims_table` (tag `table`) as compressed result-set **cache**. The public export does not export that cache. A published table label alone is not evidence of available ranked rows. TabBetter does not decode undocumented caches, reconstruct seeds from ballots, or guess group type from labels. Breakouts and all other published sets remain under Other published standings, with their source labels intact.

## Display and limitations

- Event selection filters both rounds and standings. Round options belong only to that event. The round selector is disabled until an event is selected. Changing the event clears the round selection. Refresh retains valid selections and search text, clearing vanished selections.
- Standings are event-wide. Round selection affects round cards only, explicitly disclosed above standings. A row's `round` is preserved but is not assumed to mean that a whole standings set belongs to that round.
- Rank and place are supplied by the source. Place labels (including ties) remain intact. Only exact published ranks 1, 2 and 3 receive medal classes. Unordered lists avoid implying that row position is a rank.
- Speaker names are joined only by exported student ID to publicly exported student names. Missing names display “Speaker name not published”, never a team code substituted as a person.
- Missing groups and empty sets explicitly say not published **in this public export**, with official-results fallback for absent groups. This does not claim no such standings exist on Tabroom.
- No live tournament was used to assert that speaker or prelim rankings are currently published. Tests use synthetic fixtures matching the verified source shape. Public export coverage and publishing choices vary by tournament.
- Existing ballot outcomes, conservative panel colors, verified person-ID paradigm links and source labels are retained. Compact paradigm links disclose login in their title. A single section-level warning explains published-only ballots, unknown panel size and unconfirmed panel outcome.

## Verification

`tests/standings.test.mjs` covers source-field preservation, publication filtering, special and other standings, medals/tie labels, absent identities/ranks, dependent event/round changes, refresh retention, pairings isolation, empty cached-only tables, section warnings, compact links, and observing the final rendered DOM. The first six tests were observed failing before implementation. Additional rank-list and DOM-order regressions were also observed failing before correction.
