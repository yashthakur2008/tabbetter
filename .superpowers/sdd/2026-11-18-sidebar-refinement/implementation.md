# Sidebar refinement implementation and acceptance

Date: 2026-11-18. Branch: `design/sidebar-refinement`.
Baseline: live-main `e3d4430`. **Tested implementation: `17f4f68`**.

## Delivered and boundaries

- Permanent desktop header **Sidebar** button with `Hide sidebar` / `Show sidebar` accessible name, `aria-expanded`, and `aria-controls="workspace-sidebar-slot"`. The header survives every route remount and remains available with the sidebar hidden.
- Validated `sidebarHidden` boolean in the existing `tabbetter-workspace-v1` record, default false. Existing records migrate by defaulting this missing optional field. Malformed/nonboolean/unsupported-version data cannot hide navigation. Storage denial retains a usable session-only choice.
- Desktop grid transitions from a 240px navigation track to zero in 220ms. Hidden navigation is inert, invisible, noninteractive and excluded from keyboard traversal. Main expands from 1200px to 1440px at a 1440px viewport. Existing readable content max-width remains: directory rows grow from 1136px to 1200px rather than unbounded line lengths.
- Mobile retains Menu and the existing native dialog/drawer. Desktop-hidden preference never disables its navigation. Resize back to hidden desktop restores focus to the header toggle. Resize to shown desktop retains the prior destination/current route. Resize from focused desktop controls to mobile restores Menu, including Chromium's blur-before-media-change ordering.
- Subtle static theme-aware lighting in the header and sidebar, stronger headings/row titles/nav labels, hand-drawn decorative SVG navigation icons with original text labels retained, and short row hover/focus feedback. No hero, pointer spotlight, continuous motion or new dependency.
- Published event chips use only the existing `classifyEvents` known `group` metadata. Speech is teal, debate is warm bronze. Unknown labels remain neutral, even when their names contain “speech” or “debate”. Selected matches add an outline without recoloring the category.
- Save commits state and updates its accessible button in place before a single 280ms scale pulse. Repeated activation cancels previous feedback. OS or user reduced motion prevents new feedback, and the existing global motion handler cancels a running pulse immediately when the OS preference changes. Persistence never waits for animation completion.
- Actual screenshot inspection exposed fragmented “tournaments” text beside Sort at 320px/150%. Results-header controls now wrap as a unit rather than squeezing the count mid-word.

Production changes stay in six existing files: `web/workspace.js`, `web/workspace.css`, `web/index.html`, `web/styles.css`, `web/discovery.js`, `web/discovery.css`. Styles were edited at their owning definitions, not added as a trailing override pile. No changes to API parsing/classification, schedule/calendar, settings or tutorial semantics, CSP, server policy, dependencies, or release configuration.

No subagents, branch changes, push, merge, deploy, login or upstream mutation. The first coordinator checkpoint was delivered at approximately three minutes. Independent review and live release remain coordinator-owned.

## Test selectors and observable contracts

| Surface | Selectors / contract |
|---|---|
| Header toggle | `#workspace-sidebar-toggle`, native Space/Enter activation, dynamic accessible label/expanded state |
| Desktop shell | `#workspace-sidebar-slot`, `#workspace-navigation`, `main`; inert hidden navigation and expanded main width |
| Mobile | `#workspace-menu`, `#workspace-drawer`, `#workspace-drawer-close`; Escape, keyboard cycle and both resize directions |
| Settings | `#theme`, `#workspace-text-size`, `#workspace-motion`; actual settings controls, not test-injected root datasets |
| Discovery | `[data-discovery-row]`, `[data-discovery-save]`, `.event-speech`, `.event-debate`, `#discovery-count` |
| Category selection | `#discovery-events summary`, `[data-event="oo"]`, `[data-event="pf"]`; selected categories remain visually distinct |
| Preferences | `tabbetter-workspace-v1.sidebarHidden`; strict boolean acceptance, reload and route remount |

`tests/sidebar-browser.test.mjs` runs the actual compiled Worker, adapters, routing, styles and DOM in installed Playwright. Only external public-source responses are deterministic tournament fixtures. It does not replace app functions or fabricate a mock sidebar. Its HTTP server returns only `Internal server error` on failure and logs diagnostics server-side.

Existing `workspace-browser` tests gained two desktop-to-mobile focus regressions. Workspace preference tests cover default, malformed, versioned, boolean roundtrip and blocked storage. Discovery UI tests execute the real normalizer and renderer to prove known/unknown chip classification. Existing source-style checks were preserved except the obsolete blanket ban on header `color-mix`, which conflicts with the explicitly approved subtle lighting. The header still has an opaque canvas fallback and no backdrop filter. Compiled-browser checks verify its actual opaque background.

## Red-first evidence and iteration

Evidence logs are in this report's directory locally. They are not all committed as generated test output.

1. `red-unit.log`: new sidebar-default and denied-storage tests failed with `undefined` instead of false/true. The new known-category renderer test also failed before chip classes existed. These tests preceded production changes. The focused unit suite subsequently passed **36/36**.
2. `red-browser.log`: compiled Chromium failed `permanent desktop header toggle exists`, actual **0**, expected **1**, before production edits.
3. `red-typography.log`: the large-text typography assertion already passed because the existing compiler converts font sizes to rem. The actual red was `speech and debate visually distinct`, both `rgb(24, 28, 37)`. This is not presented as a newly fixed font-scaling bug.
4. `red-save.log`: after sidebar/category work, the strengthened real-browser test failed `save starts a bounded transform animation`. Initially merely counting animations had accidentally accepted an existing color transition. The test was corrected to inspect transform keyframes before implementing the pulse.
5. `red-resize.log`: desktop controls lost visible focus on mobile resize. Instrumentation showed `focusout` could occur before the media query change callback, with `document.activeElement` becoming body. The fix transfers only that breakpoint blur and also handles engines that retain the focused hidden element. Tests wait on the visible focus outcome, not merely on the synchronously changed media query.
6. `red-count-reflow.log`: screenshot-driven regression selected the actual “tournaments” text with a DOM Range at 320px/150%. It occupied **2** line rectangles instead of **1**. Wrapping the count/Sort flex layout fixed it.
7. `red-selected-chips.log`: selecting both known events made both chips `rgb(14, 43, 46)`. Removing the old match background override preserved categories and retained the match outline.

Intermediate runs remain distinguishable from final acceptance. Two old style checks initially failed, leading to an explicit opaque header fallback and removal of an unnecessary shadow transition. WebKit's normal pointer-click behavior does not focus buttons; a test originally assumed it did. The save focus-preservation test now explicitly focuses the real control and activates it with Enter, verifying preservation rather than browser-specific pointer focus policy. No application behavior was changed to force mouse focus.

## Final verification

All final commands below ran against the production/test contents committed as `17f4f68`. `acceptance-*` files are the final logs, not the earlier `full`, `final-*`, or `verified-*` iterations.

```sh
export PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright/index.mjs
export TABBETTER_PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright
export TABBETTER_SCREENSHOT_DIR=/Users/yashthakur/.jcode/scratch/sidebar-refinement/evidence
npm test
BROWSER_ENGINE=firefox node --test tests/*browser.test.mjs
BROWSER_ENGINE=webkit node --test tests/*browser.test.mjs
node scripts/test-discovery-browser.cjs
node scripts/test-member-paradigms-browser.cjs --live
node scripts/test-schedule-live.mjs
npm run check
npm run validate
git diff --check
```

| Check | Result | Final evidence |
|---|---|---|
| Build + full suite with Chromium opt-in | **361 passed, 0 failed, 0 skipped** | `acceptance-full.log` |
| Firefox compiled browser suites | **10 passed, 0 failed, 0 skipped** | `acceptance-firefox.log` |
| WebKit compiled browser suites | **10 passed, 0 failed, 0 skipped** | `acceptance-webkit.log` |
| Existing discovery browser suite | All workflows passed | `acceptance-discovery.log` |
| Existing member/paradigm suite with live source | Passed, 271 member links / 267 shortcuts; zero runtime errors | `acceptance-members-live.log` |
| Existing live schedule suite | Passed, actual four-event ICS downloads and viewer-timezone-independent checks | `acceptance-schedule-live.log` |
| Repository hygiene / syntax | Passed | task terminal output |
| ESM artifact validation | Passed, exports `default.fetch` | task terminal output |
| Diff whitespace | Passed | `git diff --check` |

Browser coverage includes existing tutorial lifecycle and modal keyboard loops, all tournament tasks, metadata progress, schedule downloads, malformed/denied preferences, actual theme/text-size selections, hidden/shown remounts and reloads, mobile drawer, both resize directions, Save keyboard focus/persistence, finite animation keyframes, OS cancellation, user motion override, event selection, row hover, default density and responsive reflow. The old discovery suite retains ANY/ALL, circuit, location/radius, online, CSV, preview, stale-response and privacy coverage.

## Built screenshots and measurements

Evidence root: **`/Users/yashthakur/.jcode/scratch/sidebar-refinement/evidence/`**.

- `sidebar-{chromium,firefox,webkit}-metrics.json`: **24 samples per engine**, zero horizontal document overflow. Each includes 1440/390 default text and 320/390/768/1440 extra-large text, desktop preference both states, light/dark, actual row rectangles and visible-row counts.
- `sidebar-{engine}-{1440,390}-{shown,hidden}-{light,dark}-default.png`.
- `sidebar-{engine}-{320,390,768,1440}-{shown,hidden}-{light,dark}.png` for 150% text.
- Existing competition/workspace screenshots and `task2-{engine}-metrics.json` are refreshed by the full browser suite, including fresh/dismissed welcome and tutorial/settings/drawer checks.

Inspected actual compiled screenshots, not design mockups: Chromium desktop shown/dark/default and extra-large, desktop hidden/light/default, mobile hidden/dark/default, and 320px hidden/light/extra-large. Inspection found and verified the count-reflow correction. Header controls remain available, new icons align with labels, speech/debate chips are distinct, compact separators remain, mobile labels/actions wrap without document clipping, and the static lighting is restrained. Cross-engine screenshots were captured as evidence; visual manual inspection concentrated on Chromium plus automated layout checks across all engines.

Representative **Chromium, 1000px viewport height**, fresh welcome visible:

| Width / text | Sidebar preference | First row top | Row height | Row width | Complete visible rows |
|---|---|---:|---:|---:|---:|
| 1440 default | shown | 534.55 | 114.50 | 1136 | 4 |
| 1440 default | hidden | 534.55 | 114.50 | 1200 | 4 |
| 390 default | either | 749.30 | 224 | 358 | 1 |
| 320 extra-large | either | 1120.36 | 368 | 288 | 0 |

The default main area is **1200px shown / 1440px hidden**, recovering the full 240px navigation track. The existing content readability cap accounts for row width growing by 64px at this particular desktop viewport. At 390px the existing returning-user competition test records **594.11px** first-row top, matching the coordinator's baseline. Fresh default desktop/mobile row positions remain 534.55/749.30px. No welcome content was hidden to manufacture density.

Firefox has the same row sizes with approximately 0.02px top rounding differences. WebKit's native control metrics yield earlier fresh first rows (491.05px desktop, 682.30px mobile) with the same row widths/heights. All extra-large test widths measured exact document widths of 320, 390, 768 and 1440px in both preference states.

## Limitations and handoff

- Full-page screenshots and DOM/accessibility properties are verified, but no physical screen reader or browser-chrome screenshot session is claimed.
- At 320px/150%, readable text and the visible welcome naturally place the first row below the fold. This is not hidden content or horizontal overflow. Native single-line input placeholders/select labels can truncate while their accessible labels and controls remain usable.
- New deterministic sidebar tests establish app behavior, not current upstream tournament availability. Separate legacy live suites read current public data. The member suite observes the official unauthenticated login redirect, not authenticated paradigm contents.
- Theme-aware lighting follows the existing accent in Midnight rather than overriding the user's palette. The existing readable content max-width is intentionally retained.
- Review and release remain outstanding by ownership, not an implementation blocker. No deploy or public-site change occurred.

## Independent-review nit closeout

Coordinator-authorized narrow follow-up to `review.md`. **Follow-up implementation/test commit: `687feb9`**. Only `web/index.html` and `tests/sidebar-browser.test.mjs` changed before this report appendix.

1. Removed the redundant trailing `↗` from the official Tabroom navigation label. The leading custom SVG remains decorative, the label remains **Open official Tabroom**, and the exact destination/target/rel are unchanged. New compiled-browser assertions check the destination-selected anchor's plain label and the retained single SVG. Before the change, `review-label-red.log` failed with actual `Open official Tabroom ↗` versus expected `Open official Tabroom`. Afterward it passed. The actual Midnight desktop screenshot was inspected and the orphan arrow is gone.
2. Retained the independent review's previously supplemental all-theme checks in the maintained sidebar suite. Cases now include Light, Dark, Midnight, System/light OS and System/dark OS. Each uses the real Settings selector, reloads, verifies persisted selection and resolved effective theme, then checks actual discovery reflow, distinct event-chip colors and at least 4.5:1 chip text contrast. The 901px desktop breakpoint is included alongside 320/390/768/1440 for extra-large text. Default text retains 390/1440. Both sidebar preferences are exercised throughout. **No theme defect or invented red is claimed:** these existing all-theme behaviors passed immediately, consistent with independent supplemental findings.

Fresh verification of `687feb9` contents:

| Check | Result | Evidence |
|---|---|---|
| Full build/test with Chromium browser opt-in | **361 passed, 0 failed, 0 skipped** | `review-followup-full.log` |
| All compiled Firefox browser suites | **10 passed, 0 failed, 0 skipped** | `review-followup-firefox.log` |
| All compiled WebKit browser suites | **10 passed, 0 failed, 0 skipped** | `review-followup-webkit.log` |
| Focused Chromium follow-up | Passed | `review-followup-green.log` |
| Hygiene/syntax, artifact validation, whitespace | Passed | task output / `git diff --check` |

The same commands/environment documented above were used for full and browser suites. The legacy live suites were not rerun for this label-only production change; their preceding final and independent-review passes remain documented above. No schedule/API/theme production code was changed.

The existing evidence root now contains **70 samples per engine, 210 total**, with **zero horizontal overflows**. `sidebar-{engine}-metrics.json` adds an `os` field. Screenshot names retain the previous light/dark names and add `midnight`, `system-light`, and `system-dark`. Examples:

- `sidebar-chromium-1440-shown-midnight-default.png` (manually inspected corrected single external indicator)
- `sidebar-firefox-901-shown-system-dark.png`
- `sidebar-webkit-320-hidden-system-light.png`

This supersedes the earlier 24-sample/light-dark-only maintained coverage description. Previous behavior, security and release boundaries are unchanged. Ready for reviewer closeout and coordinator release decision.
