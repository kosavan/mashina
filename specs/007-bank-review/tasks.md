# Tasks — reviewed bank CSV

Input: spec/plan/research/data-model/contracts/quickstart in this directory.

## Phase 1 — Setup
- [x] T001 Verify constitution, ignore rules and finalized artifacts in specs/007-bank-review/ and .gitignore.

## Phase 2 — Foundation
- [x] T002 Write migration/privacy tests in backend/tests/test_bank_import.py then add four tables in backend/migrations/versions/005_bank_review.py: UUID IDs, label 1–80 characters, unique actor/normalized label, TTL 1800 seconds/max three active previews, create/link/ignore ledger, unique non-null event_id, operation digest receipts.

## Phase 3 — US1 deliberate mapping (P1)
Independent: exact synthetic normalization, no sample cells or actual financial changes.
- [x] T003 [US1] Write backend/tests/test_bank_csv.py before parser: explicit encodings/delimiters/date/sign, RUB/EUR/USD, 2 MiB/1000 rows/50 columns/2000 description characters, headers/ragged/precision/incoming/zero/privacy.
- [x] T004 [US1] Implement typed pure backend/bank_csv.py and private sources/immutable mapped previews in backend/bank_import.py; no raw persistence.
- [x] T005 [US1] Test and install authenticated owner-only CSRF upload/source/preview endpoints in backend/bank_api.py and backend/app.py.

## Phase 4 — US2 explicit review (P1)
Independent: linked fuel/service unchanged, create exact cost once.
- [x] T006 [US2] Test first then implement indexed amount/currency ±3 days/max five candidate count and explicit atomic create/link/ignore in backend/tests/test_bank_import.py and backend/bank_import.py using Store.mutate(connection=c).
- [x] T007 [US2] Test/enforce live version/deletion, one-to-one links, immutable membership and fresh permissions in backend/bank_import.py and backend/bank_api.py.

## Phase 5 — US3 durable identity (P1)
Independent: retry/concurrency/restore never duplicate, legitimate equal no-ID purchases possible.
- [x] T008 [US3] Test/implement stable source/bank-ID cross-car identity, exact-file/ordinal fallback, overlap acknowledgment, changed-ID conflicts and operation replay in backend/tests/test_bank_import.py and backend/bank_import.py.
- [x] T009 [US3] Test driver/foreign/disabled/revoked/admin provenance isolation and private export in backend/tests/test_bank_import.py and backend/bank_api.py.
- [x] T010 [US3] Test/implement 005 bank archive validation, preserved receipts/expired previews, 004/005 notification validation and true legacy migration in backend/backup.py and backend/tests/test_backup.py; update revision fixtures.

## Phase 6 — US4 mobile review (P1)
Independent: 360 px mapping→link/create→confirm→repeat, visible failure/offline states.
- [x] T011 [US4] Write frontend/src/bankReview.test.ts then typed selection/currency-separated new sums helpers in frontend/src/bankReview.ts; no autochoices.
- [x] T012 [US4] Build lazy Russian frontend/src/BankImport.tsx and integrate frontend/src/OwnershipTools.tsx; 50-row pages, preserved errors/choices, online-only, themes/a11y/safe-area and private export.
- [x] T013 [US4] Add frontend/tests/bank-review.spec.ts real-owner/demo/stale/retry/offline/pagination journeys and inspect headless 360 px dark/light screenshots.

## Phase 7 — Cross-cutting
- [ ] T014 Measure 1000×10000 matching under two seconds in backend/tests/test_performance.py; full regression/static/build/container CI evidence in specs/007-bank-review/validation.md.
- [ ] T015 Document formats/privacy/restore in README.md and docs/, tools/check_secrets.py, Spec Kit converge, source-only PR and verified final CI.

Dependencies: T001→T002→US1→US2→US3→US4→validation. Tests before corresponding code; shared modules edited sequentially. Independent parser checks and frontend helper checks can run together after stabilization, as can backend and frontend regression. No parallel-agent implementation required. Deliver only all four stories after convergence; current CSV importer retained.
