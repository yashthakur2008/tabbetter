# Contributing to TabBetter

Start with an issue describing a real user problem and testable acceptance criteria. Keep each branch focused on one issue. Use readable commits such as `feat(data): normalize public tournament exports` and reference the relevant issue.

Pull requests must explain the resulting behavior, validation actually performed and material risks. The initial import stack represents a previously built prototype organized for review; its commit order is not a historical development log.

## Review and merging

- Run repository checks and the tests relevant to your change.
- Build and validate the Worker when runtime or UI changes affect its artifact.
- Request CodeRabbit review after repository installation is confirmed.
- Treat CodeQL as a security analysis tool, not a substitute for correctness or human review.
- Address actual findings in follow-up commits with descriptive messages.
- Merge stacked PRs from the bottom of the dependency chain upward; retarget the next PR after each merge.
- Do not merge a change solely to improve the contribution graph. Preserve accurate authorship, dates, reviews and CI outcomes.

Account-only Tabroom workflows must use an authorized integration. Do not collect Tabroom passwords, bypass publication settings, expose raw exports, or scrape private ballots. Follow source freshness, upstream-load and accessibility requirements.

## Deployment

GitHub publication is separate from production deployment. No workflow in this repository deploys automatically. Domain setup and tabbetter.com launch remain separately tracked work.
