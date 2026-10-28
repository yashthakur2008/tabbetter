# Changelog

## Unreleased — initial prototype import

The existing prototype is being introduced through five reviewable pull requests. This section records proposed source coverage, not a claim that every PR has merged or that a new production release has been deployed.

### Proposed

- Source-backed tournament discovery with filters, sorting, bookmarks and CSV.
- Circuit browsing and organized tournament workspaces.
- Publication-aware entries, judges, schedules, pairings and results.
- Reproducible Worker builds and host-cache fallback regression tests.
- Co-founder attribution for Yash Thakur and the TabBetter nonprofit initiative.
- Contribution templates, CodeRabbit configuration and CodeQL security analysis.

### Review fixes

- Replaced the legacy HTML script-tag matcher with direct standalone JavaScript syntax checks after actual CodeQL findings.

- Converted source markup to plain text without recursive tag replacement or repeated entity decoding, following CodeQL findings.

- Escaped route-derived labels at their HTML insertion boundaries after CodeQL XSS findings.

### Pending integrations

- CodeRabbit repository activation and completed review output.
- Reviewed launch of tabbetter.com with verified DNS and HTTPS.
- Supported account integration for private assignments, paradigms and ballots.
