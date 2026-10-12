# Tasks: Body damage map
Input: [spec](spec.md), [plan](plan.md), [model](data-model.md), [contract](contracts/api.md).
Tests are mandatory per FR-012 and constitution. Execute sequentially; [P] is file independence.

## Phase 1: Setup
- [X] T001 Specify acceptance and research current hooks in specs/013-body-damage-map/spec.md and research.md.
- [X] T002 Plan data/contracts/validation in specs/013-body-damage-map/plan.md, data-model.md, contracts/api.md and quickstart.md.

## Phase 2: Foundation
- [X] T003 Add failing CRUD/validation/idempotency/financial-invariant tests in backend/tests/test_body_damage.py.
- [X] T004 Add additive versioned body_damages migration in backend/migrations/versions/007_body_damage.py without editing released definitions.
- [X] T005 Implement normalization in backend/body_damage.py: title 1–120, notes 0–4000; five views/matching panels; finite x/y 0–1 rounded four decimals; enumerated types/severity/status; dates not future, repair not before discovery; optional integer odometer 0–3000000; exact nonnegative estimate; max20 unique image IDs with before/after phase.

## Phase 3: US1 - Mark, edit and synchronize
Independent test: two points on one panel at 360 px, edit/filter/delete/undo, offline reload/replay once.
- [X] T006 [US1] Integrate owner-scoped mutation/state/version/audit/receipts in backend/storage.py and backend/access.py.
- [X] T007 [US1] Extend typed state/mutations and old-cache projection/conflict recovery in frontend/src/types.ts, offline.ts and permissions.ts.
- [X] T008 [US1] Add SVG geometry and typed view/panel definitions in frontend/src/BodyDiagram.tsx and bodyGeometry.ts; native keyboard/point controls and list alternative.
- [X] T009 [US1] Implement lazy profile map/list and dirty-safe CRUD sheet in frontend/src/BodyDamage.tsx, Views.tsx and body-damage.css, including six-card pagination and status filters.
- [X] T010 [US1] Test all-view keyboard geometry, 360 px CRUD/undo and offline create/edit/reload/replay in frontend/src/bodyDamage.test.ts and frontend/tests/body-damage.spec.ts.

## Phase 4: US2 - Repair evidence and history
Independent test: before/after photos, server-owned status history, same-car service link, unchanged totals/mileage.
- [X] T011 [US2] Validate same-car active new service/image links, retain unavailable historical links and server-owned status history in backend/body_damage.py and storage.py.
- [X] T012 [US2] Add before/after upload/reuse/preview/unlink, repair/estimate fields, dated status history and pending/online explanations in frontend/src/BodyDamage.tsx.
- [X] T013 [US2] Test cross-car/nonimage links, private image access, historical deletion, repair costs and photo roundtrip in backend/tests/test_body_damage.py and frontend/tests/body-damage.spec.ts.

## Phase 5: US3 - Ownership, backup and upgrade
Independent test: actual old schemas upgrade, restore/restart includes new records/files, drivers cannot edit.
- [X] T014 [US3] Extend CSV and revision007 restore validation plus existing bank/machine/notification safety branches in backend/app.py, backup.py and body_damage.py.
- [X] T015 [US3] Extend actual schema matrix to 001–007 and body-record backup/security tests in backend/tests/test_upgrades.py, test_body_damage.py and tools/check_container_restore.py.

## Phase 6: Polish and release
- [X] T016 Add bilingual UI, isolated demo issues, dark/light/reduced-motion/error/empty states in frontend/src/locales/en.json, demo.json, backend/demo.py and body-damage.css.
- [X] T017 Run required regressions, visual headless inspection and performance budget; converge against specs/013-body-damage-map artifacts.
- [X] T018 Document operation/upgrades and shipped roadmap in docs/body-damage.md, docs/body-damage.ru.md, docs/updating.md, docs/updating.ru.md, docs/roadmap.md, docs/roadmap.ru.md and README files; bump version and RELEASES.md, freeze new migration, publish source-only reviewed release with green exact-source CI.

## Dependencies and opportunities
Foundation -> US1 -> US2 -> US3 -> final convergence/release. US3 upgrade tests can
run independently after the foundational migration. Geometry and pure normalization
unit tests can be written independently; file-shared mutations stay sequential.
Incremental strategy: prove marker CRUD first, then evidence/links, then restoration.

## Phase 7: Convergence
- [X] T019 [FR-007, US1/AC3, SC-002; partial/HIGH] Extend frontend/tests/body-damage.spec.ts to reload a representative older IndexedDB cache without body_damages, then create/edit/reload offline and synchronize exactly once. Existing old-queue tests cover events but not new condition records.

- [X] T020 [FR-001, FR-010; user visual feedback] Replace the angular generic car with a contemporary proportioned SVG body, curved panels, refined wheels/glazing/lighting in BodyDiagram.tsx, bodyGeometry.ts and body-damage.css; visually inspect five views in both themes and re-run marker hit/keyboard/mobile regressions.
