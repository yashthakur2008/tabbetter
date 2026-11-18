# Independent review: sidebar refinement

**Verdict: APPROVE WITH NONBLOCKING NITS.** No release-blocking functional, accessibility, security or preservation regression found in the reviewed change.

Reviewed production/test range: `e3d4430..17f4f68`. Review checkout HEAD was `141d7ef`, which adds the implementation report only. Reviewed `implementation.md`, all six production-file changes, new tests and changed existing assertions. Independently rebuilt and ran acceptance on 2026-11-18. No production source, tests, dependencies, CSP, branches or release configuration were changed by this reviewer. No subagents or release actions were used.

## Findings, prioritized

### P3: duplicate external-link indicators create an orphan arrow in desktop navigation

- Location: `web/index.html`, official Tabroom anchor inside `#workspace-navigation`, combined with the new flex icon treatment in `web/workspace.css`.
- Reproduce: default text, 1440px desktop viewport, sidebar shown. The link now has a leading custom external-link SVG and the retained trailing `↗`. The latter wraps to a separate line below “Open official Tabroom”. Reproduced visually in both Chromium dark and Firefox Midnight screenshots listed below.
- Impact: minor avoidable clutter and extra vertical space, not lost functionality or an accessibility blocker. The destination remains clearly labeled and usable.
- Suggested follow-up: remove the duplicate trailing arrow or keep the external indicator attached to its label without clipping large text. This does not block approval.

### P3: persist the missing theme coverage in the maintained regression suite

- Location: `tests/sidebar-browser.test.mjs`, both theme loops.
- Current committed loops cover `light` and `dark` only. The implementation report accurately describes this coverage, but Midnight and System were part of this review's all-theme requirement.
- Independent supplemental tests closed the gap for this review: all themes, System with both OS schemes, three engines, default/extra-large text and 320/901/1440px widths passed. Consider retaining this coverage in future maintained tests. No production theme defect was found.

## Independent commands and outcomes

Evidence directory: `/Users/yashthakur/.jcode/scratch/sidebar-independent/`.

```sh
export PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright/index.mjs
export TABBETTER_PLAYWRIGHT_MODULE=/Users/yashthakur/github/trailblazer-website/node_modules/playwright
export TABBETTER_SCREENSHOT_DIR=/Users/yashthakur/.jcode/scratch/sidebar-independent
npm test
BROWSER_ENGINE=firefox node --test tests/*browser.test.mjs
BROWSER_ENGINE=webkit node --test tests/*browser.test.mjs
node scripts/test-discovery-browser.cjs
node scripts/test-member-paradigms-browser.cjs --live
node scripts/test-schedule-live.mjs
node /Users/yashthakur/.jcode/scratch/sidebar-independent/supplemental.mjs
node /Users/yashthakur/.jcode/scratch/sidebar-independent/chrome-contrast.mjs
npm run check
npm run validate
git diff --check
```

| Independent check | Observed result | Evidence |
|---|---|---|
| Rebuild + full opt-in Chromium suite | 361 passed, 0 failed, 0 skipped | `full.log` |
| Firefox compiled browser suites | 10 passed, 0 failed, 0 skipped | `firefox.log` |
| WebKit compiled browser suites | 10 passed, 0 failed, 0 skipped | `webkit.log` |
| Legacy discovery smoke | All reported workflows passed | `discovery.log` |
| Legacy members/paradigms + live source | Passed, 271 member links / 267 shortcuts, zero runtime errors | `members-live.log` |
| Live schedule acceptance | Passed on correctly configured invocation | `schedule-live-retry.log` |
| Supplemental actual-worker themes/reflow/inert focus | Passed in Chromium, Firefox and WebKit, 90 combinations | `supplemental.mjs`, `supplemental.json`, `extra-*.png` |
| Supplemental chrome/row contrast | 45 sampled foreground/background pairs passed 4.5:1 | `chrome-contrast.mjs`, `chrome-contrast.json` |
| Repository syntax/hygiene, ESM artifact, whitespace | Passed | Review tool output |

The first live-schedule invocation omitted `PLAYWRIGHT_MODULE` and failed before launching a browser with `ERR_INVALID_ARG_TYPE`. Its diagnostic is retained in `schedule-live.log`. The corrected invocation passed. The first supplemental chrome-contrast script used a nonexistent `.discovery-row p` selector and failed before producing measurements. It was corrected to the actual `.discovery-field-label` selector, then all checks passed. Neither was an application defect, and neither required source changes.

## Requirement checks and source assessment

- **Persistent desktop toggle and expansion:** real native Space/Enter activation, accessible name/expanded state, focus retained on toggle, reload and route remount persistence, and main width recovery are exercised in each engine. Desktop main grows by the full 240px track. The retained content readability cap means directory rows grow less at 1440px, intentionally rather than falsely claiming unbounded content width.
- **Hidden navigation unreachable:** production sets `inert` on the hidden desktop slot in addition to visual/nonpointer hiding. Supplemental tests attempted programmatic focus of hidden Settings and traversed 80 native Tab presses per engine. None entered hidden navigation.
- **Storage denial/malformed records:** browser denial preserves a usable session-only toggle, navigation remains recoverable, and unit tests enforce boolean/version validation and safe defaults. Source uses the existing preference record and does not overwrite unrelated settings.
- **Mobile and resize both ways:** existing mobile Menu/dialog remains independently usable when the desktop preference is hidden. Tested drawer Escape, dialog keyboard traversal, desktop toggle/nav focus moving to mobile Menu, and focused mobile navigation moving to hidden desktop toggle. Shown-desktop destination restoration remains covered by the existing workspace suite.
- **Motion:** actual animation keyframes are bounded, saving is immediate, the focused save element is retained, OS reduction cancels running animation, user reduction suppresses new animation, and sidebar transition disappears under reduction. Source introduces no continuous animation or pointer-following effect.
- **Truthful event chips:** classes are drawn only from known `group` metadata. Real normalizer/renderer tests leave unknown labels neutral even when they contain “Speech” or “Debate”. Selected matches preserve category backgrounds while adding outlines.
- **Old features:** legacy discovery exercised search, ANY/ALL events, circuit, location/radius, online, preview/focus, save, CSV-related flow, privacy/stale-response and keyboard/reduced-motion behavior. Full suite retains tutorial, route/tasks, metadata and schedule coverage. Live member/paradigm and schedule smoke separately used current public upstream data.
- **Security and scope:** no CSP weakening, application-function substitution, parsing/classification changes, dependency change, or upstream mutation. New scratch supplements import the real compiled Worker and use its actual routes/styles/DOM. Only external tournament responses are deterministic fixtures for those supplements. They do not mount a CSS-only imitation of the UI.

## All-theme contrast and reflow

Actual rendered speech/debate computed foreground/background colors were measured in all three engines. Ratios, consistent across the tested engines:

| Theme | Speech | Debate |
|---|---:|---:|
| Light | 5.21:1 | 6.73:1 |
| Dark | 9.44:1 | 7.50:1 |
| Midnight | 7.26:1 | 7.50:1 |
| System / light OS | 5.21:1 | 6.73:1 |
| System / dark OS | 9.44:1 | 7.50:1 |

The additional Chromium check sampled actual header crumb, sidebar label/normal/active text, toggle, row title, and muted row label colors. It calculated the new srgb gradient endpoints and row-hover mixture from the actual resolved theme tokens. The lowest sampled ratio was **5.20:1**, light header crumb at the tinted endpoint. These are foreground/background calculations, not a claim of a complete automated accessibility audit or pixel-antialiasing analysis.

The 90 supplemental samples covered all theme/OS combinations above, default and 150% application text, and widths 320, 901 and 1440px in each engine. Every measured document width fit the viewport. Maintained browser tests additionally cover 390 and 768px and both sidebar preferences, count-word integrity and desktop density. Settings were changed through real controls, not injected root datasets.

## Actual visual inspection and purposeful change

Manually inspected these independently captured, compiled-app screenshots:

- `sidebar-chromium-1440-shown-dark-default.png`
- `sidebar-chromium-1440-hidden-light-default.png`
- `sidebar-webkit-320-hidden-light.png` (150% text)
- `extra-firefox-midnight-default-1440.png`

The change has a clear purpose beyond test compliance. Icons make destinations faster to distinguish while retaining text. Teal/bronze category chips add meaningful information without fabricating event classification. Heavier headings and row names improve hierarchy without increasing the hero area. Low-intensity static lighting separates header/navigation from the working surface without overwhelming it. The hidden-sidebar view clearly recovers workspace area and leaves a visible restore control. There is no giant hero, new content block, or continuous motion.

At 320px/150% the count remains intact, labels/actions wrap, and rows remain readable with no horizontal document clipping. Native single-line input/select contents can truncate, but their labels remain available. The pre-existing welcome and generous large-text layout place the first row below the fold at this extreme width. That is an accepted readability tradeoff, not evidence of hidden content or a newly added hero. Desktop stays compact. Midnight intentionally retains its existing purple accent rather than forcing teal over the selected theme.

## Limits and handoff

- Approval applies to the reviewed committed implementation and the documented environment, not an untested future change or a production deployment.
- No physical screen reader, mobile hardware, browser-chrome zoom, authenticated Tabroom session, forced-colors mode, or complete app-wide WCAG audit was performed.
- Large-text evidence is the application's real 150% setting, not a claim of 200% browser zoom acceptance.
- Fixtures ensure repeatable UI behavior, while separate live suites cover current public upstream integration. Authenticated paradigm contents remain unverified. No user accounts or upstream data were modified.
- No blocking follow-up is required. Coordinator owns any optional nit cleanup, final release decision and deployment.
