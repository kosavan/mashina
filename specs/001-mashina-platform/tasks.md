# Tasks: MASHINA
**Input**: spec.md, plan.md, research.md, data-model.md, contracts/api.md.
**Tests**: explicitly required by product brief; write behavioral tests before implementation.

## Phase 1: Setup
- [x] T001 Configure locked Python/Vite dependencies and checks in pyproject.toml and frontend/package.json.
- [x] T002 Configure private data/build ignores in .gitignore and .dockerignore.

## Phase 2: Foundational
- [x] T003 Implement versioned schema, ownership, transactions and audit in backend/migrations/versions/001_initial.py and backend/storage.py.
- [x] T004 Implement exact Decimal money, validation and unified event payloads in backend/domain.py; amounts >=0, odometer integer 0–3000000, UUID IDs.

## Phase 3: User Story 1 — Garage (P1)
**Independent test**: protected bootstrap, two cars, persistence and archive roundtrip.
- [x] T005 [US1] Write bootstrap/auth/ownership/vehicle integration tests in backend/tests/test_api.py.
- [x] T006 [US1] Implement bootstrap token, Argon2id, sessions, CSRF, throttling in backend/app.py and backend/cli.py.
- [x] T007 [US1] Implement versioned vehicle mutation in backend/storage.py; name 1–100, year 1886–next year, status active/archived/sold.
- [x] T008 [US1] Build premium responsive shell, auth, garage/profile/photo forms and themes in frontend/src/App.tsx, frontend/src/Forms.tsx and frontend/src/style.css.

## Phase 4: User Story 2 — Daily records (P1)
**Independent test**: exact expense/fuel/maintenance CRUD, history and undo.
- [x] T009 [US2] Write item/fuel/odometer/idempotency/conflict tests in backend/tests/test_domain.py and backend/tests/test_api.py.
- [x] T010 [US2] Implement validated events/categories, hash receipts and optimistic versions in backend/storage.py; category 1–80, stable UUID IDs, one financial row/event.
- [x] T011 [US2] Build quick-add forms, positions/discounts, templates, historical warnings and draft guards in frontend/src/Forms.tsx.
- [x] T012 [US2] Build timeline search, sorting, category/date filters, edit/delete/undo in frontend/src/Views.tsx.

## Phase 5: User Story 3 — Analytics and reminders (P1)
**Independent test**: known full/partial cycles, period baselines, due/soon/recurrence.
- [x] T013 [US3] Write fuel-cycle/period/currency/reminder tests in backend/tests/test_domain.py.
- [x] T014 [US3] Implement analytics, interval mileage, currency separation and reminder recurrence in backend/domain.py and backend/storage.py; title 1–120, nonnegative warning thresholds.
- [x] T015 [US3] Build filtered charts, car/year comparisons and reminder management in frontend/src/Views.tsx and frontend/src/Forms.tsx.

## Phase 6: User Story 4 — Documents and portability (P1)
**Independent test**: secure image/PDF, verified backup restore and linked export.
- [x] T016 [US4] Write private upload/traversal/restore roundtrip/corruption tests in backend/tests/test_api.py and backend/tests/test_backup.py.
- [x] T017 [US4] Implement scoped upload/preview/metadata/export in backend/app.py and archive validation/atomic restore in backend/backup.py.
- [x] T018 [US4] Build document search/preview and backup/export/restore settings in frontend/src/Views.tsx and frontend/src/Forms.tsx.

## Phase 7: User Story 5 — Offline PWA (P1)
**Independent test**: offline create/reload/reconnect, one event, visible conflict, logout cache clear.
- [x] T019 [US5] Write browser offline and mobile-layout journeys in frontend/tests/app.spec.ts.
- [x] T020 [US5] Implement transactional IndexedDB cache/outbox and foreground retry/conflict handling in frontend/src/offline.ts.
- [x] T021 [US5] Implement local app-shell service worker, manifest/icons and install guidance in frontend/public/sw.js and frontend/public/manifest.webmanifest.

## Phase 8: Polish and delivery
- [x] T022 Supply persistent nonroot single-service container, HTTPS example and CI in Dockerfile, docker-compose.yml, Caddyfile.example and .github/workflows/ci.yml.
- [x] T023 Document installation/security/backup/limitations in README.md and verify checks in specs/001-mashina-platform/validation.md.
- [x] T024 Verify desktop/mobile UI, required automated scenarios and production build; review requirement convergence against spec.md.
- [ ] T025 Inspect tracked files for secrets/runtime data and publish source to user's public GitHub repository.

## Dependencies & Execution Order
T001–T004 → US1 → US2 → US3/US4 → US5 → delivery.
Tests precede corresponding implementation. Shared files edited sequentially.
Parallel opportunities: UI assets and domain tests in separate files; US3 domain tests
and US4 backup tests can be independently authored after foundational contracts.
Per-story examples: US1 auth tests/garage styling; US2 domain tests/timeline styles;
US3 charts/reminder tests; US4 backup tests/document styling; US5 icons/offline tests.

## Implementation Strategy
Deliver all five stories for the requested MVP. Validate each story independently,
then cross-cutting security, restore and offline checks. Physical iPhone, container
runtime and timing measurements must be reported separately if unavailable.



## Phase 9: Stack amendment and demo
- [x] T026 Implement typed React/Tailwind/shadcn UI, Query state and lazy Recharts in frontend/src/App.tsx and frontend/src/components/ui/.
- [x] T027 Implement SQLAlchemy 2 Core, Alembic startup migration and WAL runtime guard in backend/storage.py and backend/migrations/.
- [x] T028 Add Vitest utilities, migration/performance tests and performance budgets in frontend/src/utils.test.ts and backend/tests/test_performance.py.
- [x] T029 [US6] Implement isolated demo sessions, synthetic seed and reset in backend/demo.py; verify separation in backend/tests/test_demo.py.
- [x] T030 Implement configurable retained backup CLI and same-disk guidance in backend/cli.py and README.md.

## Phase 10: Convergence
- [x] T031 CRITICAL Implement exact pending item/fuel totals in frontend/src/offline.ts and test arithmetic per FR-014, Constitution I (partial).
- [x] T032 Add confirmed-mileage cost trend to backend/domain.py and frontend/src/Analytics.tsx per FR-008 (missing).
- [ ] T033 Verify 360px layouts across all screens, explicit sync conflicts and additional fuel/maintenance journeys in frontend/tests/app.spec.ts per US2/AC3, US5/AC3, SC-005 (partial).
