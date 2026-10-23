# TabBetter

**Less searching. More debating.**

TabBetter is a nonprofit initiative making speech and debate tournament information easier to find and use. It provides an independent, read-only companion to Tabroom, with clearer tournament discovery, entries, judges, schedules and published pairings.

**Co-founder: [Yash Thakur](https://github.com/yashthakur2008).**

Planned domain: **[tabbetter.com](https://tabbetter.com)**. Domain launch is tracked separately from this source-code import.

## Project status

An initial working prototype exists. This repository introduces that existing work through focused, linked pull requests rather than one large source drop. Import commits are dated when they are made; the sequence describes code organization, not a reconstructed development timeline.

The initial review stack covers:

1. Contribution standards, CI and review configuration.
2. Public Tabroom data adapters and publication-boundary tests.
3. The tournament directory and workspace interface.
4. The Worker runtime, build tooling and runtime regression tests.
5. Architecture, feature coverage and launch documentation.

Review status is reported from actual checks and reviewers. Configuration for a review service does not mean that the service is installed or has approved a change.

## Scope and relationship to Tabroom

TabBetter is independent of Tabroom and the National Speech & Debate Association. Public exports only contain information the upstream service publishes. Official account actions, registration, private ballots, paradigms and tournament administration remain on Tabroom until an authorized integration is available.

The project does not claim registered charity or tax-exempt status. Its nonprofit mission and co-founder attribution describe the initiative; they do not imply affiliation with NSDA.
