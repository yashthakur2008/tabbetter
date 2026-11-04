# TabBetter feature and data audit

Verified 2026-10-23. Independently written companion UI; no Tabroom application source was copied into this project.

## Source code and data sources

- Legacy Perl/Mason: https://github.com/speechanddebate/tabroom
- Current v4 monorepo: https://github.com/speechanddebate/Tabroomv4
- Archived Node API repository: https://github.com/speechanddebate/indexcards (archived Aug 31, 2026; points to v4)
- Legacy schema: `doc/sql/current-schema.sql` in the legacy repository.
- Current schema/models and test data: `indexcards/api/data/schema.ts`, models, and `indexcards/tests/test.sql` in v4. These describe structure / development fixtures, not a copy of Tabroom's production database.
- Official data-access explanation: https://www.tabroom.com/index/help.mhtml
- Public tournament JSON: `/api/download_data.mhtml?tourn_id=<id>`. An unauthenticated request returns the public export. No credentials are supplied by this app. Only a matching ID with `public` set to true/1 is accepted.
- Public calendar and circuit pages supply listing/filter metadata that the JSON export does not.

No production database connection, complete production dump, or supported third-party account integration was found or obtained. Repository visibility does not grant production database access.

The official help page says the JSON endpoint is useful for individual use and not a supported third-party app integration. The live Results directory and Paradigm pages redirect unauthenticated requests to login. Tabroom's robots.txt excludes many app/account/result/posting paths. We used the explicitly documented public export for structured tournament data, not attempts to circumvent those restrictions.

## Coverage

| Tabroom feature                                 | TabBetter implementation                                             | Access / remaining work                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Upcoming tournaments                            | Live imported directory; table and card views                        | Public HTML; 10-minute cache                                                       |
| Search                                          | Search current listing by tournament, city, location                 | Client search; cross-season search via year filter                                 |
| Circuit / school year / state / country filters | Source-backed selectors                                              | Public calendar query parameters                                                   |
| Mode / registration / judge signup              | Mode and status filters, seeking-judges filter, source text          | No invented registration eligibility                                               |
| Sorting / exports / printing                    | Name, city, date sorting; CSV; print layout                          | CSV exports current filtered listing; print current page                           |
| Circuit directory                               | Searchable directory and circuit calendars                           | Public HTML; 1-hour cache                                                          |
| District calendar                               | Available through circuit filter                                     | NSDA district circuit is source-backed                                             |
| Invitations                                     | Text paragraphs and source links                                     | Complex rich formatting is simplified                                              |
| Event lists / divisions                         | Events tab and event filters                                         | Fields present in public JSON; extended rules stay in invitation                   |
| Entry lists                                     | Search entry/code/school, filter by event                            | Public export; withdrawn/waitlisted entries omitted                                |
| School lists                                    | School names and codes                                               | Public export                                                                      |
| Judge lists                                     | Search name/school, filter pool                                      | Public export                                                                      |
| Pairings / rooms / flights                      | Search/filter published round sections                               | Only rounds and judges the public export includes                                  |
| Judging assignment lookup                       | Search published pairings by judge name                              | No authenticated personal assignment feed or obligation tracking                   |
| Results                                         | Released scores and public result sets                               | Private feedback remains on official site; global directory opens there            |
| Schedule                                        | Public structured timeslots, time zone display, ICS                  | Event-specific start details may exist only in invitation                          |
| Links / uploads / maps                          | Resources extracted from tournament invitation                       | Links open at original source; documents are not rehosted                          |
| Dates / deadlines                               | Structured registration deadlines and invitation                     | Original invitation is authoritative                                               |
| Judge hiring signup                             | Official tournament signup link                                      | Registration action occurs on Tabroom                                              |
| Paradigms                                       | Dedicated section and official directory link                        | Sign-in required; no mirror/search of authenticated data                           |
| School registration, rosters, invoices          | Dedicated official account handoff                                   | No server-side Tabroom credentials or mutation integration                         |
| Judge preferences / conflicts                   | Official account handoff                                             | Requires authorized account integration                                            |
| Ballot submission / private feedback            | Official account handoff                                             | Not implemented in TabBetter                                                       |
| Notifications / live updates                    | 5-minute active tournament refresh                                   | Push/email, diffs and personalized alerts not implemented                          |
| Tournament administration                       | Help and official account links                                      | Setup, paneling, pairing, tabbing, room pools, result publishing are not recreated |
| Help / status / about                           | Organized guide directory, service status links, project disclosures | Source documentation remains official                                              |
| Bookmarks                                       | Saved tournament list                                                | Device local storage, no cross-device account                                      |

This is broad public browsing coverage, not complete feature parity. Authenticated workflows must be integrated through an authorized supported mechanism before being represented as native TabBetter functionality.

## Actual samples checked

- Calendar: 257 listings in one retrieved source response; counts change over time.
- Circuits: 162 circuit rows in the retrieved response; calendar filter contains more circuit options, including inactive circuits.
- CFL Super Debate 1, ID 41209: 27 schools, 343 active/nonwaitlisted entries, 273 judges, 8 events, 0 published rounds at retrieval.
- JW Patterson HS Invitational at Heritage Hall, ID 40089: 43 schools, 85 active/nonwaitlisted entries, 80 judges, 3 events, 3 published rounds, 85 exported ballots at retrieval.
- Missing pairings are described as missing in the export, never as proof that a judge is unassigned.

## Synchronization

The backend accepts only fixed Tabroom paths and validated identifiers/filters. It never accepts an arbitrary upstream host. No auth cookies or credentials are forwarded. Calendar and invitation responses cache for 10 minutes, public exports for 5 minutes, circuits for 1 hour. A named Cloudflare edge cache (when supported by the host) and a bounded in-memory cache reduce requests; in-flight requests coalesce within a Worker instance. This is not a globally coordinated crawler, so multi-region traffic can cause separate refreshes. A central durable scheduler/coordinator and an agreed service integration are needed before high-volume public use.

Cache entries carry source URLs and retrieval timestamps. Warm-instance stale data is labeled if refresh fails. There is no permanent synchronized production-data archive. Prototype directory captures are not shipped in this repository. Raw student/judge export dumps are not committed, and there is no permanent synchronized production-data archive.

The normalizer explicitly whitelists output fields; raw exports, contact details, registrations' internal IDs, arbitrary settings and written feedback are not exposed. No unpublished results are synthesized. User-facing source text is HTML-escaped. Upstream login redirects fail closed.
