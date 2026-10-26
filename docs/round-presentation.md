# Round presentation semantics

TabBetter displays published votes, not a reconstructed official panel decision. An explicit `winloss` value of `1` means WIN and `0` means LOSS. Missing, duplicate or nonbinary decisions remain neutral. Full entry panels are green or red only when all exported ballots agree and are explicit. Even unanimous exported ballots may be an incomplete panel, so the interface retains its publication warning.

## Debate positions

Tabroom's binary ballot `side` values are 1 for affirmative and 2 for negative. Event settings can customize these names, but the public export does not include those settings. Aff/Neg are defaults. Gov/Opp for recognizable parliamentary event names are conventional labels, not a claim to reproduce tournament-specific wording.

British Parliamentary (`wudc`) positions instead come from `speakerorder`: 1 = Opening Government, 2 = Opening Opposition, 3 = Closing Government, 4 = Closing Opposition. Speaking order and side must remain separate, including in Public Forum. Unknown positions must not be guessed from entry order.

## Judge paradigms

A ballot's `judge_person` is a person identifier. Only a validated positive numeric person identifier may form a link to `https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=ID`.

The ballot's `judge` is a tournament registration identifier, not a person identifier. The public category judge list does not supply its private person relationship. Never substitute a registration ID or match by name. Where no person ID is published, no paradigm link is available. Anonymous requests to the paradigm endpoint redirect to login. Links disclose that login is required, and TabBetter does not scrape or proxy private paradigm text.

## Verified source evidence

Checked against official Tabroom source commit `c350e25c20d3cb442d6ff554907c493355ab52d9`:

- `web/api/download_data.mhtml`, lines 1642–1658: public ballot identity fields.
- `web/index/paradigm.mhtml`, lines 18–24: person ID and authentication handling.
- `web/panel/schemat/wudc_side_save.mhtml`, lines 45–48: British Parliamentary position storage.
- `web/funclib/wudc_order.mas`, lines 15–27: British Parliamentary position labels.

## Progressive presentation

Themes use semantic color tokens, persisted locally when storage is available. Outcome text remains visible independently of color. Scroll reveals are optional, once per card identity during a page session, and do not hide content when browser animation APIs are unavailable. Reduced-motion preferences suppress the effect.
