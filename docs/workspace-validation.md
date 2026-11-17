# Competition workspace validation

## Reproduce the pre-release checks

Use the already installed Playwright package. No dependencies need to be installed.

```sh
export PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright/index.mjs
export TABBETTER_PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright
npm test
npm run check
npm run validate
for engine in chromium firefox webkit; do
  BROWSER_ENGINE=$engine node --test \
    tests/workspace-browser.test.mjs \
    tests/competition-browser.test.mjs \
    tests/discovery-progress-browser.test.mjs \
    tests/schedule-browser.test.mjs
done
node scripts/test-discovery-browser.cjs
node scripts/test-member-paradigms-browser.cjs --live
node scripts/test-schedule-live.mjs
```

`npm test` builds the actual Worker. The browser opt-in is required: without `PLAYWRIGHT_MODULE`, browser tests deliberately skip. The original `.cjs` harnesses take the package **directory**, while the newer tests and live schedule harness take its **index.mjs** file. Set `TABBETTER_SCREENSHOT_DIR` to save competition-layout and schedule screenshots.

## Evidence boundaries

- `tests/schedule.test.mjs` executes the production schedule module. The minimal four-slot fixture is the exact public representation observed for tournament 41209 on 2026-11-17, without participant data.
- `tests/schedule-browser.test.mjs` serves supplemental upstream fixtures through the compiled Worker's real adapters, CSP, HTML, router and browser controls. It compares LA and UTC browser contexts, reads actual downloaded ICS bytes, and exercises interpretation/reset/refresh/error/reflow behavior. It is **not live evidence**.
- `scripts/test-schedule-live.mjs` uses the compiled Worker with ordinary public upstream requests. There is no fetch replacement or response interception. The imported four-slot constants are assertions only, never response bodies. A changed/unavailable source fails explicitly rather than being replaced. Output contains only schedule metadata, download summaries and aggregate workflow results, not rosters.
- The original member harness includes synthetic identity cases. Its `--live` part additionally reads actual 41209 public identity evidence and checks the unauthenticated official redirect without following login. It does not establish authenticated paradigm availability.
- Local compiled acceptance is not deployed-domain acceptance. The coordinator must review and release separately.

## Schedule contract

`web/schedule.js` owns schedule parsing, interpretation state, rendering and ICS serialization. The compiler embeds it before `app.js`, with the same closing-script safety check. `app.js` only notifies tournament entry and delegates Schedule rendering.

Accepted source timestamps use `YYYY-MM-DD[T or space]HH:mm:ss`, optionally ending in `Z` or a numeric `±HH:mm` offset. Calendar fields and ranges are validated rather than Date-normalized. Offset-bearing timestamps already identify instants. Offsetless timestamps do not: their default presentation preserves published wall time and says **Timezone not specified in source**.

The selector offers an unselected placeholder, UTC, and the validated published tournament IANA timezone, with UTC aliases deduplicated. Its choice is memory-only, retained across tabs and refreshes of the current tournament, cleared on tournament switch and page reload. A Calendar attempt without a required choice focuses the selector and leaves persistent inline instructions explaining effects on both display and export. The invitation and tournament timezone remain separately visible.

Conversion round-trips candidate timezone offsets around the date. Gaps and folds, including non-hour transitions and skipped civil dates, block the entire export with a precise message. Invalid timezone metadata, malformed dates/ranges and genuinely empty schedules have distinct feedback. No invalid slot is silently dropped. ICS contains UTC instants matching the selected display conversion, CRLF lines, unique event UIDs, DTSTAMP, escaped text and UTF-8-aware 75-octet folding.

## Remaining release gates

The source still does not establish whether 41209's offsetless values mean UTC or tournament-local time. Neither tests nor invitation comparisons resolve that fact. The explicit interpretation is a user choice, not a claim about upstream semantics. Unsupported timestamp shapes fail visibly instead of being guessed. Browser timezone data comes from `Intl`, with no new timezone dependency.

The generic non-Schedule date formatter and unrelated directory/registration date policies were not redesigned here. Account claiming/login and authenticated official content remain outside this feature. Independent coordinator review, deployment, exact released-version recording, apex/www smoke and real calendar-client import remain separate release checks. See `.superpowers/sdd/2026-11-17-competition-workspace/task-3-report.md` for the exact tested source and results.
