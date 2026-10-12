# Tasks: scoped API and optional MCP

## Setup

- [x] T001 Resolve protocol, authorization, transport and restore decisions in specs/008-machine-access/research.md and plan.md; finish data-model.md/contracts/api.md/quickstart.md.

## Foundation

- [x] T002 Add failing lifecycle, original-owner and credential isolation tests in backend/tests/test_machine_access.py.
- [x] T003 Implement additive credential/grant/receipt schema and history index in backend/migrations/versions/006_machine_access.py; extend migration fixtures.

## US1 — controlled credentials

Independent check: default-off, demo/delegated/foreign grants denied; issue once/list masked/revoke/expiry and feature disable enforced.

- [x] T004 [US1] Implement verifier-only credentials, transaction-scoped auth, scoped issue/list/revoke and audit in backend/machine_access.py.
- [x] T005 [US1] Install session-only CSRF management and isolated bearer dependency in backend/machine_api.py/backend/app.py.
- [x] T006 [US1] Revoke credentials on password/reset/disable in backend/accounts.py with tests.

## US2 — useful scoped API

Independent check: exact reads exclude private fields; fresh rights on replay; exact writes retry once without cross-key collision.

- [x] T007 [US2] Add strict recursive models and explicit output projections in backend/machine_models.py; test nested unknown fields/private extensions.
- [x] T008 [US2] Implement bounded keyset history/search, reminders and shared complete-history analytics in backend/machine_api.py; add 10000-event budget tests.
- [x] T009 [US2] Implement transactional scoped mutation/receipt namespaces and version conflicts in backend/machine_access.py; test concurrent retry/revoke/rollback and period fuel calculations.
- [x] T010 [US2] Publish bearer-only OpenAPI contract and document domains/errors/limits in docs/machine-access.md.

## US3 — optional STDIO MCP

Independent check: real subprocess handles both protocol eras and four read-only tools; bounded fixed upstream, no secret leaks or late response after cancel/EOF.

- [x] T011 [US3] Add fake-upstream and framed subprocess tests in backend/tests/test_machine_protocol.py covering metadata/discovery/legacy/errors/transport bounds/cancellation/EOF.
- [x] T012 [US3] Implement secure fixed upstream and async bounded protocol adapter in backend/machine_protocol.py.
- [x] T013 [US3] Document private client environment setup and protocol compatibility in docs/machine-access.md.

## US4 — finished UI and durability

Independent check: restore revokes all keys while preserving existing bank/notification/files; 360px themes/copy-once/revoke/error/offline journeys work.

- [x] T014 [US4] Validate archive credential relationships/receipts and revoke restored keys in backend/machine_archive.py/backend/backup.py; test legacy/current backups and malformed archives.
- [x] T015 [US4] Build lazy Russian settings flow with explicit grants, secret copy/manual fallback, discard warning and offline/errors in frontend/src/MachineAccess.tsx and app/style integration.
- [x] T016 [US4] Add headless 360px dark/light copy-once/revoke/offline/error tests and visual inspection in frontend/tests/machine-access.spec.ts.

## Cross-cutting verification

- [x] T017 Run full Pytest/Vitest/Playwright/static/build/budgets and tracked-source secret scan; document actual evidence in specs/008-machine-access/validation.md.
- [x] T018 Publish source-only PR, attach it, pass Linux Docker CI and run Spec Kit converge against all acceptance scenarios; close gaps before completion in specs/008-machine-access/tasks.md.

## Dependencies and delivery

T001→T002→T003→US1→US2; US3 follows stable read contracts, US4 restore follows schema/lifecycle. UI can be developed independently after management contracts stabilize, protocol tests independently after read DTOs; no automatic delegation required. Finish each tested vertical slice before marking its tasks complete. Credential foundation is the first increment, not a claim of the whole 2.0 release.

## Phase 7: Convergence

- [x] T019 [US2] Close C001 (HIGH, partial, US2 acceptance3/SC002): implement strict explicit reminder completion date/actual-odometer input with stable operation/version and shared repeat validation in backend/machine_models.py/backend/machine_access.py; test missing confirmation, repeat advancement, retry and no invented mileage/expense in backend/tests/test_machine_access.py; correct contracts/api.md/docs/machine-access.md to describe the implemented operation.
- [x] T020 [US1] Close C002 (MEDIUM, partial, US1 acceptance3): show the explicitly granted car names on each key card in frontend/src/MachineAccess.tsx, with a safe unavailable-car fallback, and verify scope visibility plus preservation of a new secret while revoking another key in frontend/tests/machine-access.spec.ts.
- [x] T021 [US3] Close C003 (MEDIUM, partial, FR005/SC004 protocol accuracy): accept finite numeric JSON-RPC IDs, validate required legacy client identity, negotiate the advertised legacy version and test the four-request concurrency bound in backend/machine_protocol.py/backend/tests/test_machine_protocol.py.
