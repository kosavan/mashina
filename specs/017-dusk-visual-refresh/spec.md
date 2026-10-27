# Dusk visual refresh

Accepted: 2026-10-26. Scope: application, GitHub Pages, demo imagery and repository
screenshots. This is visual work; vehicle and financial behavior stays compatible.

## Outcomes and acceptance

1. Daily garage, vehicle, history, fuel, service, tires, analytics, documents,
   reminders, settings and record forms share a coherent Dusk design.
2. Both complete themes work from 360px upward; focus, reduced motion, safe areas,
   long text and right-to-left interface remain usable.
3. Welcome and GitHub Pages use local licensed landscape photography. Demo car
   images are clearly fictional, locally bundled and consistent with the theme.
4. English/Russian README imagery is recaptured from the actual isolated demo,
   including garage, analytics and overview artwork. No personal data is used.
5. Public site retains links, truthful claims, metadata and its explicit packaging
   allowlist. Fonts and imagery require no external runtime request.
6. Existing migrations, schema, API payloads, record IDs, financial calculations,
   settings and pending offline queues remain unchanged. No reset is required.
7. Relevant browser journeys, frontend checks/tests/build, documentation,
   migrations, secret scan and public-site validation pass. Publication follows
   exact-source CI; physical device verification is not inferred from emulation.

## Expanded visual scope, 2026-10-26

The user additionally requested a new logo and color suited to Dusk. Explore three
original vector directions with the local logo-design skill. The owner selected
A, Fold M, and approved the production kit and rollout. The MASHINA name stays.
The user also requested rebuilding the website product image: remove nested
outlines and the blue screenshot gutter, show readable smoked-glass vehicle
surfaces, and capture real fully loaded images with transparent empty margins.

## Plan

Keep the existing React components and handlers. Apply semantic theme tokens and
shared Dusk styles, adjusting only presentation markup. Retain local Manrope and
MASHINA identity. Reuse existing localization, demo, image and offline paths.
Build the static site from explicitly named files and verify referenced assets.
Capture synthetic EN/RU screens after the final application build, then regenerate
the deterministic repository overview images. Publish reviewed source via GitHub
CI and the existing checked-source Pages workflow.

## Tasks

- [x] Inventory existing application/site, brand, facts and compatibility constraints
- [x] Establish shared Hallmark Dusk direction and file ownership
- [x] Complete app and light/dark responsive styling
- [x] Complete site and explicitly allowlisted local assets
- [x] Refresh demo images, actual screenshots and overview artwork
- [x] Run accessibility/visual review and regression checks
- [x] Preserve exact-source CI and checked-source GitHub Pages publication

## Validation, 2026-10-26

Final follow-up verification on 2026-10-27 covers the selected Fold M kit,
neutral glass cards, fully decoded transparent-gutter captures, matching public
icon copies and cache-version changes when bundled icon bytes change. The final
app/profile/localization/PWA group passed 24 browser tests; four additional
offline/font journeys passed after the cache versioning change.

- Frontend TypeScript/ESLint/Prettier, production build and 36 unit tests passed.
- Existing browser suite: 54 passed, including Chromium, WebKit PWA safe areas,
  360px primary screens, light theme, all interface languages, financial entry,
  old IndexedDB queue, offline retries, private photos and original downloads.
- Added RTL installed-PWA landscape/tablet offset coverage passes in Chromium
  and WebKit; the Dusk landscape is included in the initial public offline cache.
- Backend: 298 passed, 12 skipped locally (optional tooling/environment paths).
- Documentation links/language, frozen migration fingerprints and secret scan
  passed. Site build validates local references and exact packaged source bytes.
- Hallmark static: app and site have zero Floor failures and zero open Reflex
  findings. Independent visual review found one narrow-screen car crop; corrected
  to a 16:9 cover. Requested Dusk glass is retained as reviewed material.
- EN/RU deterministic overview compositions pass HyperFrames runtime/layout/lint
  checks at 0.3, 1 and 4 seconds. No video is added.
- Physical device testing and owner-server deployment are outside this refresh.
  Exact-source CI and publication evidence are recorded in the associated GitHub
  pull request and Actions runs; local checks do not substitute for that gate.
