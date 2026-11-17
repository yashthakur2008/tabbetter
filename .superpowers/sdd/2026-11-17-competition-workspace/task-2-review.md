# Task 2 independent review

Date: 2026-11-17
Verdict: **Changes requested: one P2 presentation/accessibility regression.** No P0/P1 findings. Calendar source, timezone and ICS defects are explicitly outside this verdict and remain Task 3.

## Scope and independence

Reviewed `994d2f9..638396d`, excluding coordinator documentation commit `b2ca4bc`. Read the approved design specification, Task 2 plan/brief, implementation report and baseline audit. The checkout was clean at review start, with HEAD `f93873a` (the separate implementation-report commit above `638396d`), rather than literally at `638396d`. The inspected implementation is the requested revision. No source edits, dependency installations, branch changes, subagents, push, merge or deployment were performed. Only this review document is added in the repository. Test scripts and additional evidence are in scratch storage.

## Prioritized finding

### P2: Preserve a visible loading state when hiding the completed metadata-check action

**Location:** `web/discovery.css:72`, interacting with `web/discovery.js:135-136` and `discoveryCheckNext()`.

The new rule `#discovery-check-next:disabled { display: none; }` treats *busy* and *completed* as the same state. The existing renderer disables this button while a metadata or calendar request is pending, not only when no unchecked tournaments remain. It also changes the label to **Checking published details…**. The new CSS now hides that progress message throughout the request. This is a regression from the visible disabled progress control, not a request to restore the useless completed action.

**Actual compiled-browser reproduction:** serve 24 external tournament fixtures, wait for the first automatic batch to finish (`12 of 24 checked`), delay subsequent upstream detail responses, then activate **Check next 12**. Chromium reported:

```json
{
  "buttonText": "Checking published details…",
  "display": "none",
  "coverage": "12 of 24 checked · 12 with published details. Matches may be incomplete.",
  "visibleBusyText": false
}
```

The list and coverage text remain unchanged while the request is pending, and the only checking message is removed from rendering and the accessibility tree. Users receive no visible indication that their action is still running. This conflicts with the approved requirement to distinguish loading from empty/unavailable states and preserve existing discovery behavior. The request eventually succeeds, so this is not a data-fetch failure.

**Requested change:** hide only the idle/exhausted action, using an explicit completion/visibility state rather than `:disabled`. Retain a visible pending indicator, preferably a polite status message, while metadata checks run. Do not let this fix reintroduce the completed button into the compact layout.

**Regression acceptance:** use more than 12 records and a deliberately delayed external response. Verify the real compiled UI has visible pending feedback after manual activation, keeps stale/partial results clearly distinguishable from completed results, and removes the action only after checks are exhausted. Current competition tests use eight records and inspect settled results, so their passing density assertions cannot detect this state conflation.

**Evidence:** `/Users/yashthakur/.jcode/scratch/task2-independent-review-20261117/loading-probe.mjs`, `loading-probe.log`, and `loading-hidden.png`. The probe uses the compiled Worker and actual adapters/DOM, with only external fixtures and response timing controlled. No application functions or DOM state are substituted.

## Other review conclusions

- **Spec compliance:** compact aligned desktop columns, labeled mobile fields, discoverable filter controls, concise but explicit partial-coverage warning and expandable retry explanation are present. Existing selectors, filtering state and event semantics remain intact. All six primary tournament tasks are explicit, and Events, Schools, Statistics and Resources remain separately labeled. Rankings-unavailable guidance correctly distinguishes source limitations from sign-in requirements.
- **Correctness and maintainability:** changes stay within presentation/branding boundaries. The pure tournament-navigation renderer is used by actual detail rendering. Existing discovery state and routing are reused rather than duplicated. Test assertion updates inspected correspond to intentional presentation changes, not removed behavioral coverage. No additional blocking correctness or maintainability issue found in the scoped diff.
- **Security:** new row values still pass through existing escaping helpers. Brand routes use own-property checks and fixed compiled asset bytes, explicit MIME and `nosniff`. Versioned immutable assets and revalidating compatibility aliases are appropriate. No new credentials, external analytics, dynamic SVG interpolation or CSP weakening were introduced. This is source review plus regression testing, not a penetration test.
- **Accessibility:** decorative brand images use empty alt text and retain the named home link. Current tournament sections expose `aria-current`. Actual browser checks confirm 44px directory controls and primary task buttons, keyboard dialog behavior, reduced motion and large-text reflow. The loading-state issue above is the outstanding regression. No screen-reader product was operated during this review.

## Visual evidence actually inspected

Existing evidence root: `/Users/yashthakur/.jcode/scratch/tabbetter-workspace-20261117/evidence/`.

- **`current-390-initial.png`:** inspected the actual 390×900 fresh-visit screenshot, including its welcome offer. The first tournament name and event tags are visible before the fold. The full first row and actions are not. This matches the implementation report's explicit tradeoff and is not represented as a fully visible mobile row.
- **`current-1440-initial.png`:** inspected the actual 1440×1000 fresh desktop screenshot. Date/name/location/registration columns align, four fixture rows fit, and the welcome is present. The layout is materially more compact without hiding the partial-coverage explanation.
- **`task2-icons-16-32-light-dark.png`:** inspected the actual-size 16/32px SVG and raster marks plus enlarged pixel evidence. The bubble tail, two lines and dot remain distinguishable at 16px. White interior marks remain clear on teal against light and dark surroundings. This is an asset contact sheet, not evidence of browser-tab chrome.
- **`task2-chromium-320-extra-large-tournament.png`:** inspected the 320px extra-large screenshot. The title and task navigation wrap without clipping. The primary/additional section distinction remains readable. The increased vertical length is an expected large-text tradeoff.

The independent rebuilt Chromium run also generated fresh/dismissed screenshots and measurements at `/Users/yashthakur/.jcode/scratch/task2-independent-review-20261117/`. Existing four-record before/after density evidence and the independent eight-record test fixture are different datasets and must not be conflated with live tournament counts.

## Independently executed validation

Used the installed Playwright module at `/Users/yashthakur/github/trailblazer-website/node_modules/playwright/index.mjs` without installation.

| Check | Observed result |
|---|---|
| `PLAYWRIGHT_MODULE=… TABBETTER_SCREENSHOT_DIR=… npm test` | Rebuilt actual Worker, **337 passed, 0 failed, 0 skipped**, including Chromium competition/workspace tests and exact compiled asset bytes/MIME/cache checks |
| `BROWSER_ENGINE=firefox PLAYWRIGHT_MODULE=… node --test tests/competition-browser.test.mjs tests/workspace-browser.test.mjs` | **5 passed, 0 failed, 0 skipped** |
| Same targeted command with `BROWSER_ENGINE=webkit` | **5 passed, 0 failed, 0 skipped** |
| `TABBETTER_PLAYWRIGHT_MODULE=… node scripts/test-discovery-browser.cjs` | All reported workflows passed: ANY/ALL events, circuits, location/radius, online inclusion, preview/focus, saving, keyboard, responsive/reduced motion, permission denial and manual fallback, stale location and Back privacy |
| `TABBETTER_PLAYWRIGHT_MODULE=… node scripts/test-member-paradigms-browser.cjs` | All reported identity/member workflows passed, including missing/invalid/duplicate/conflicting identifiers; zero browser runtime errors and no app paradigm fetches |
| `npm run check` | Passed |
| `npm run validate` | Passed, valid ESM exporting `default.fetch` |
| `git diff --check` | Passed |
| Independent delayed-request probe | Reproduced P2 hidden busy indicator twice; requests eventually completed |

Fresh logs: `tests.log`, `firefox.log`, `webkit.log`, `discovery.log`, `members.log`, and `loading-probe.log` in the independent review evidence directory above. An initial attempted log directory was an existing file, so that first attempt did **not** execute `npm test`. It was rerun successfully in the unique evidence directory. Only the successful rebuilt run is counted here.

## Limitations and handoff

- Passing existing tests does not resolve the independently reproduced loading regression. Task 2 should be re-reviewed after the focused fix and delayed-request regression check.
- Public upstream responses in compiled-browser tests are deterministic fixtures. This review did not independently repeat live-production source smoke checks or the historical baseline builds. No deployment or apex/www release verification is claimed.
- Compiled icon response bytes, declarations, dimensions, MIME and caching passed. The extra Chromium probe observed a browser request for `mark-v2.svg`, but that URL is also the header image. It does **not** independently prove the browser chose it as the tab icon. Actual tab-chrome appearance/request selection remains release acceptance, not a newly discovered implementation defect.
- Large-text checks cover 320/390/768/1440px widths in Chromium, Firefox and WebKit, with no horizontal document overflow and >=44px tested controls. This is not a claim about physical touch hardware, all zoom factors, every tournament's live data, or every assistive technology.
- Calendar/source/timezone/ICS repairs, broader whole-workspace live acceptance and release remain Task 3. They are not blockers attached to this Task 2 review.
