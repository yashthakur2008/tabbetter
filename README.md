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

Organizational setup and domain launch are tracked separately from source-code publication.

## Run the complete import

The complete application is proposed on [`import/05-documentation`](https://github.com/yashthakur2008/tabbetter/tree/import/05-documentation) while the review stack is open.

```sh
git clone https://github.com/yashthakur2008/tabbetter.git
cd tabbetter
git switch import/05-documentation
npm test
npm run check
npm run validate
npm run dev
```

Requires Node.js 22 or newer. No runtime dependencies or package installation are required. The development server runs at http://127.0.0.1:4173.

## Find your way around

| Area                                          | Where to look                                                |
| --------------------------------------------- | ------------------------------------------------------------ |
| Scope, access boundaries and feature coverage | [Feature audit](docs/feature-audit.md)                       |
| Components and data flow                      | [Architecture](docs/architecture.md)                         |
| Issue → branch → PR → review process          | [Development and review stack](docs/development.md)          |
| Mission and co-founder                        | [Mission and team](docs/mission.md)                          |
| Contribution and review standards             | [Contributing](CONTRIBUTING.md)                              |
| Security reporting                            | [Security policy](SECURITY.md)                               |
| Hosting, domain and release process           | [Deployment](docs/deployment.md)                             |
| Planned improvements                          | [Issues](https://github.com/yashthakur2008/tabbetter/issues) |

Pushes to `main` build, test and publish the Worker to Cloudflare, currently served at <https://tabbetter.stepsense-dahacks.workers.dev>. Connecting the `tabbetter.com` apex and `www` custom domains requires moving the domain's DNS to the same Cloudflare account; the steps and verification are in [Deployment](docs/deployment.md) and tracked in issue #7.
