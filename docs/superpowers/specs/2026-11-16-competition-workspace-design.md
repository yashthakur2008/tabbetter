# TabBetter competition workspace design

Date: 2026-11-16
Status: Direction approved in chat; written specification awaiting review.
Baseline: merged main 9275f0d, deployed 2026-11-10.

## Goal and approved direction

Help ordinary speech and debate participants find tournaments, find their published round, and understand where to go without learning Tabroom's administrative structure. Preserve familiar tournament tables and event/round navigation while retaining the cleaner visual styling. The user approved a competition workspace with supplementary sidebar/dock tools, centralized settings, relevant branding and feature testing. The user additionally requested a tutorial, an on/off setting, and an explicit explanation of that setting inside the tutorial.

This is an information-architecture and usability change, not another decorative landing page or a claim of complete Tabroom feature parity. Speech and debate receive equal treatment. Mission: less time finding information, more time preparing, competing and judging.

## Navigation and layout

Use a labeled desktop sidebar rather than icon-only navigation. Primary destinations: Tournaments and Saved tournaments. Secondary group: Circuits, Rankings, Help and official Tabroom tools. Settings stays in a consistent lower-sidebar position. Do not hide essential tournament information behind a generic More menu. Mobile uses a clearly labeled Menu button opening a keyboard-accessible drawer, with the current destination shown in the page header.

The tournament directory uses compact, readable rows with date, tournament name, location/mode, event tags, registration status and save action. Desktop columns align; narrow screens use labeled stacked fields without horizontal document scrolling. Search, speech/debate events, circuit and location remain discoverable. Additional filters can collapse. Preserve ANY/ALL event semantics, source-backed circuit choices, radius and distance sorting, online inclusion, event-match sorting, filtered CSV and printing. Explain partial event coverage near the results instead of silently treating unchecked metadata as no match.

Inside a tournament, keep Overview, Schedule, Pairings, Entries, Judges and Results as explicit task labels. Preserve existing Events, Schools and Resources information within clearly labeled additional sections rather than deleting it. Event and round selectors use the same interaction pattern across Pairings and Results. Keep tournament context, selected event and return navigation understandable. Published room, flight, time and timezone information must remain visible. Never infer an assignment or result from absence of published data.

## Branding and browser icon

Create one coherent small vector mark combining a speech bubble and an organized round sheet. It must remain recognizable at 16px and 32px, with a monochrome fallback and sufficient light/dark contrast. Use the same geometry for the sidebar/header and favicon; do not imply official NSDA or Tabroom affiliation. Include SVG favicon, raster browser fallback and touch icon where supported. Serve each through the compiled Worker with correct content types and cache behavior. Replace inconsistent legacy logo usage on About as well as the main shell. Accessible brand link text is TabBetter home; decorative repeated marks are hidden from assistive technology.

## Settings

Settings is an accessible route or panel with a stable URL and a visible heading. Move the current theme selector out of the main header into Appearance. Preserve existing persisted theme selections and fresh light-default behavior. Add text size choices Default, Large and Extra large with readable reflow, and motion choices Follow device and Reduce motion. Never override an OS reduced-motion preference with forced animation. Theme/text/motion settings apply to the whole app, including dialogs and tournament tables.

Store preferences locally with schema validation and safe defaults. Handle storage denial and invalid values without breaking navigation. Do not claim cross-device synchronization. Keep keyboard focus visible and ensure settings can be reached without a pointer.

## Tutorial and persistence

Offer a short welcome prompt on the first visit after this feature is introduced; do not force users into a blocking tour. Include Start tour and Not now. Starting opens an accessible, skippable tutorial with Back, Next, Close and visible step count. Do not auto-focus or auto-open a modal repeatedly on every route or reload.

Tutorial steps:

1. Welcome: TabBetter helps you find speech and debate tournaments and read published tournament information. Some official actions remain on Tabroom.
2. Find a tournament: use search and event/circuit filters; explain speech and debate offerings and partial source coverage in plain language.
3. Find nearby tournaments: manual location or optional browser permission, distance filters, and separate online events. Never request geolocation just because the tour started.
4. Open a tournament: introduce Schedule, Pairings, Entries, Judges and Results, and event/round selectors. If no tournament is open, show a noninteractive illustration rather than claiming a specific real assignment or changing the user's selection.
5. Save and return: saved tournaments are stored on this device. Explain the sidebar and official Tabroom handoffs.
6. Make it yours: explicitly say, "You can turn this tutorial on or off in Settings → Tutorial. You can replay it there anytime." Provide a real Open Settings action and Finish.

Settings contains a clearly labeled Tutorial enabled switch and a Start tutorial / Replay tutorial action. Enabled permits the one-time welcome offer; it does not repeatedly launch a completed tour. Turning off immediately closes an active tutorial and suppresses future automatic offers. Turning on allows explicit replay without unexpectedly interrupting the current task. Replay deliberately launches a new run and enables the tutorial if necessary, with visible state feedback. Close/Not now suppress the welcome offer for that version; completion is recorded separately. All controls remain usable when local storage is unavailable, with persistence limited to the current session rather than crashing.

Use stable targets and route-aware fallback content. If an element is absent, a filter disclosure is closed, data is loading, or the route changes, do not strand the tour on an invisible target. Preserve user input and restore focus to the initiating control when it still exists. Native dialog focus behavior needs real-browser tests, including Tab, Shift+Tab and Escape. No forced route change, permission prompt, synthetic saved tournament, or fabricated personal result.

## Existing features and honest scope

Preserve public member routes, exact registration/person ID joins, direct official paradigm links, invitation links, schedules and calendar export, published standings, source timestamps, refresh behavior and saved tournaments. Conflicting identity evidence must continue suppressing a paradigm link. Official login restrictions remain explicit.

Earlier requested real TabBetter login and account claiming are not implemented on the baseline. Do not present School & registration or a local bookmark as a working TabBetter account. Any account-system implementation remains a separate security/data design, not a hidden part of this UI redesign. The competitor corpus and rankings are source-limited; do not imply exhaustive 2023–27 coverage. Source-unavailable, permission-required, loading, failed request and genuinely empty states must be distinct and provide useful next actions.

## Architecture and implementation boundaries

Keep the existing vanilla JavaScript, CSS and compiled Cloudflare Worker architecture. Add small focused modules for shell/settings and tutorial rather than expanding the already large app.js with unrelated state. Integrate through explicit initialization, route notifications and teardown. Reuse existing navigation and discovery interfaces; do not maintain duplicate calendar/search state.

Update web/index.html for the shell and icon declarations, styles at their original definitions rather than a pile of conflicting overrides, app.js for routing integration, and compile/server asset handling for new scripts/styles/icons. Preserve CSP and no-credential public data access. Settings/tour listeners must be registered once and cleaned up correctly during remounts. No new third-party analytics or tutorial service.

## Bug audit and testing

Before changes, capture a baseline against live production and the compiled local build. Record each reproduced problem, expected behavior, affected public interface and regression check. Missing favicon is already confirmed live. The rankings audit observed an initial loading state only; it is not yet evidence of a broken request. Official account/paradigm handoffs are access limitations, not automatically broken routes.

Acceptance matrix:

- Branding: actual browser tab icon request succeeds, expected MIME type and nonempty image; all app marks use new geometry; 16/32px visual inspection.
- Navigation: primary/secondary routes, deep links, Back/Forward, drawer open/close and route-change cleanup; no duplicated listeners or obsolete headings.
- Directory: search, speech/debate ANY/ALL, circuits, date/mode/registration filters, sorting, manual location, permission grant/denial, stale location responses, radius/online exclusion, clearing, unavailable/partial metadata and exports.
- Tournament: invitation/resources, event/round selection, pairings, schedule/timezone/ICS, entry/judge searches, member/back routes, published results and unavailable data states. Verify original live tournament 41209 identity links and explicit missing/conflicting-ID fixtures.
- Settings: theme persistence/migration, text size, OS/user reduced motion, valid/invalid/blocked storage, reload and cross-route application.
- Tutorial: first offer, Not now, all steps, final Settings explanation/action, close, finish, replay, off during active tour, off across reload, re-enable without surprise launch, missing targets, route changes and keyboard focus restoration.
- Accessibility: keyboard-only navigation, meaningful labels, screen-reader status messages, focus visibility, contrast, zoom/reflow and reduced motion. Check 320/390/768/1440px widths and large-text layouts.
- Regression: complete project tests, repository check, artifact validation, compiled browser suites, actual downloaded-file contents and live source smoke checks. Fixtures supplement but do not replace real public-interface acceptance.

## Release and outcome verification

Commit and review source changes, run all checks, then publish through the established PR workflow. Do not include unfinished identity draft. Once approved implementation is ready for release, deploy the exact validated source with existing Cloudflare authorization, preserve both production custom domains, record previous Worker version and verify actual apex/www browser workflows. GitHub merge alone is not deployment; missing automation credentials must not be mistaken for a live update.

Report before/after task observations: number of actions needed to reach Pairings, Settings and saved tournaments; first tournament visibility and usable row density; tutorial completion and successful replay; reproduced bugs now passing. Do not equate test counts with visual approval or claim untested account functionality.
