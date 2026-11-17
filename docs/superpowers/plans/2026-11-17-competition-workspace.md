# Competition Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the approved familiar competition workspace, relevant favicon/logo, centralized settings and optional tutorial, with verified live behavior.
**Architecture:** Preserve the existing vanilla app/router and discovery data flow. Introduce focused workspace/preferences/tutorial modules, embedded by the compiler, and keep public data and official handoffs unchanged.
**Tech Stack:** JavaScript, CSS, Node22 tests, Cloudflare Worker, existing Playwright Chromium.
**Spec:** docs/superpowers/specs/2026-11-16-competition-workspace-design.md

## Global Constraints
- Speech and debate receive equal treatment.
- No new third-party analytics or tutorial service.
- Preserve CSP and no-credential public data access.
- Never override an OS reduced-motion preference with forced animation.
- No forced route change, permission prompt, synthetic saved tournament, or fabricated personal result.
- Keep existing theme storage compatibility and test genuine public interfaces; fixtures supplement live checks.
- No unfinished identity draft, account login or synthetic rankings claims.

## Task 1: Workspace, settings and tutorial
Files: create web/workspace.js, web/workspace.css, web/tutorial.js and focused tests/workspace.test.mjs, tests/tutorial.test.mjs. Modify web/index.html, web/app.js, scripts/compile.mjs and relevant existing tests.
Interfaces: workspace initializes after app/discovery declarations, uses existing navigate/route, exposes renderWorkspaceSettings() and workspaceRouteChanged(). Tutorial exposes startTutorial(), stopTutorial(), and a settings-state synchronization callback. Decide names consistently and document if adjusted before implementation.
- [ ] Capture current baseline tests with `npm test`.
- [ ] Add failing tests exercising validated preferences, blocked storage fallback, tour enable/disable/dismiss/complete/replay transitions and theme migration. Use actual module code, not copied implementations.
- [ ] Replace top-navigation More/theme layout with labeled sidebar, mobile drawer, persistent Settings destination and clear official-tools labeling. Route changes close drawer and tour safely and restore focus where possible.
- [ ] Implement Settings appearance/text/motion and tutorial controls using native inputs. Keep theme select compatible with existing initTheme or migrate theme logic with regression coverage. Storage keys remain bounded/versioned.
- [ ] Implement six-step optional tutorial per approved spec. Offer a nonmodal first-use welcome; no surprise modal on reload. Final step must contain exact discoverable Settings → Tutorial explanation, actionable settings link, and Finish. Off stops an active tour; replay enables it deliberately. Tests cover blocked storage, keyboard/focus, missing targets and route changes.
- [ ] Integrate scripts/styles into actual compiler and preserve closing-tag safety checks and existing VM extraction interfaces. Run `npm test`, `npm run check`, `npm run validate`.
- [ ] Commit only task-owned files and produce implementation report describing observed tests and remaining integration assumptions.

## Task 2: Competition presentation and branding
Files: web/discovery.css, web/discovery.js, web/styles.css, web/app.js, web/index.html, assets, scripts/compile.mjs, src/server.mjs, targeted branding/runtime/presentation tests.
Interfaces: consume Task1 shell geometry/settings; don't create duplicate search state. Existing directory selectors and route URLs retained where possible for test compatibility.
- [ ] Reproduce baseline density and navigation issues with compiled browser; save desktop/mobile screenshots and element measurements.
- [ ] Add assertions for brand/favicon asset MIME, consistent header/About mark, directory semantic structure and tournament task labels before changes.
- [ ] Create coherent speech-bubble/round-sheet mark with favicon and touch variants. Wire actual icon URLs through Worker and update all brand surfaces. Verify assets served rather than merely checking markup.
- [ ] Refine tournament list into compact readable aligned rows, preserve mobile labels and event/source coverage. Preserve live filter/sort/CSV/save/preview behavior and visible primary tournament tabs. Keep additional Events/Schools/Resources accessible.
- [ ] Remove obsolete style definitions when replacing them. Test large text and OS reduced motion as well as default layout; no horizontal document overflow at320/390/768/1440.
- [ ] Run focused tests plus full suite and commit task files; report before/after measurements and tradeoffs honestly.

## Task 3: Whole-workspace acceptance, bug fixes and release
Files: scripts/test-workspace-browser.cjs, existing browser harnesses, docs/workspace-validation.md and only production files required by reproduced findings.
Interfaces: compiled worker default.fetch, actual DOM routes, real public source and deployed custom domains.
- [ ] Create browser acceptance harness using installed Playwright module `/Users/yashthakur/github/trailblazer-website/node_modules/playwright`; do not weaken CSP or install unnecessary packages.
- [ ] Exercise tutorial first offer/dismiss/start/next/back/finish/settings link/replay/disable/reload and storage rejection. Exercise desktop/sidebar and mobile drawer via real pointer/keyboard, Back/Forward, large text, contrast and reduced motion.
- [ ] Run existing discovery/member suites after adapting only selectors legitimately changed by design; retain all behavioral assertions. Check actual CSV/ICS download contents and search/filter/pairing/member workflows. Record red reproductions for discovered faults, fix minimal source, rerun covering checks.
- [ ] Run actual public calendar and tournament41209 browser/API smoke, distinguish unavailable data from route failures and authenticated official handoffs from native features.
- [ ] Request independent broad review of baseline37867d8 through final diff; fix material findings, rerun affected checks and get scoped re-review.
- [ ] Validate full313+ tests, repository check, artifact validation, browser suites and clean exact committed source. Document per-requirement outcomes and baseline/current observations.
- [ ] Publish feature PR, wait for checks, merge under already-authorized solo-owner protections, and deploy exact validated source with existing Wrangler OAuth. Record previous deployed version and preserve custom domains.
- [ ] Verify real https://tabbetter.com and https://www.tabbetter.com return new assets and render new shell/tutorial/settings; perform real interaction smoke without fixture interception. Report actual deployed version and limits, not merely a green checks-only workflow.

## Review and release gates
Task1 and Task2 have independent spec/quality review before proceeding. Final review covers their integration plus Task3. Failures must be fixed or explicitly reported, never erased by weakening assertions. User approved written spec on2026-11-17. Work occurs on design/competition-workspace, not main. No repository-protection changes are needed.
