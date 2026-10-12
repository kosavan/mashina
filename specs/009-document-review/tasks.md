# Tasks: Reviewed document recognition
**Input**: spec.md, plan.md, research.md, data-model.md, contracts/api.md
**Tests**: Required by constitution/user; generated fixtures and fake providers only.

## Phase 1 — Setup
- [x] T001 Record scope, research and design in specs/009-document-review/{spec,plan,research,data-model,quickstart}.md and contracts/api.md; verify constitution and no hooks.

## Phase 2 — Foundation
- [x] T002 Write strict suggested/reviewed-field adversarial and exact-calculation tests in backend/tests/test_recognition_models.py.
- [x] T003 Implement untrusted nullable suggestions and explicit reviewed-data validation in backend/recognition_models.py using shared domain calculations.
- [ ] T004 Add additive draft/claim migration in backend/migrations/versions/007_document_review.py and upgrade/restart tests in backend/tests/test_recognition.py.

## Phase 3 — US1: Deliberate processing
Independent test: image/scanned PDF creates only a private draft after consent; disabled/error cases send nothing unintentionally.
- [x] T005 [US1] Add normalized image/scanned/encrypted/malformed/oversized PDF and deadline tests in backend/tests/test_recognition_media.py.
- [x] T006 [US1] Add optional pypdfium2 dependency/locked installs and bounded child rendering in backend/recognition_media.py and backend/recognition_worker.py; document notices in docs/document-recognition.md.
- [ ] T007 [US1] Test fixed destination/TLS/redirect/response bounds/consent/retry/config changes using local fake transport in backend/tests/test_recognition_transport.py.
- [ ] T008 [US1] Implement fixed optional processor transport in backend/recognition_transport.py and environment/Compose configuration in .env.example and docker-compose.yml.
- [ ] T009 [US1] Implement actor-private attempt lifecycle and session/CSRF endpoints in backend/recognition.py and backend/recognition_api.py; install in backend/app.py without startup requests.
- [ ] T010 [US1] Verify original-owner/live-source ACL, active-user checks, one-active-attempt limits, uncertainty/no-auto-retry and no-history-before-confirmation in backend/tests/test_recognition.py.

## Phase 4 — US2: Review once
Independent test: corrected expense/fuel/service confirms once under repeat/concurrency, source linked and exact totals preserved.
- [ ] T011 [US2] Add concurrency/replay/duplicate-content/linked-source/odometer/permission-revocation tests in backend/tests/test_recognition.py.
- [ ] T012 [US2] Integrate explicit source claims before receipt replay and atomic claim/link after event creation in backend/storage.py and backend/recognition.py; prevent forged event-data provenance.
- [ ] T013 [US2] Implement actor-keyed durable review editing and top-level outbox recognition metadata in frontend/src/documentReview.ts, frontend/src/offline.ts and frontend/src/types.ts; test in frontend/src/documentReview.test.ts.
- [ ] T014 [US2] Implement lazy source comparison/edit/confirmation UI in frontend/src/DocumentReview.tsx and Documents entry in frontend/src/Views.tsx with source previews and existing queue feedback.
- [ ] T015 [US2] Verify offline edits/reload/pending/conflict recovery and no provider replay in frontend/tests/document-review.spec.ts.

## Phase 5 — US3: Finished safe capability
Independent test: 360px both themes plus full restore; hostile output and demo never cause hidden actions.
- [ ] T016 [US3] Add strict restore validation/export/provenance recovery in backend/recognition_archive.py, backend/backup.py and backend/app.py; test archives/upgrades001–006 and uncertain processing recovery in backend/tests/test_recognition.py.
- [ ] T017 [US3] Finish styles/loading/empty/error/consent/demo/a11y/reduced-motion in frontend/src/style.css and frontend/src/DocumentReview.tsx; inspect dark/light screenshots and automated 360px flows in frontend/tests/document-review.spec.ts.
- [ ] T018 [US3] Document setup/local cloud-disable/privacy/bounds/retention/uncertain retries in docs/document-recognition.md and README.md; keep inference optional, no real provider calls.

## Phase 6 — Verification
- [ ] T019 Run complete static/backend/frontend/mobile/build/secret/low-power checks and Linux Docker CI; record actual evidence in specs/009-document-review/validation.md.
- [ ] T020 Run Spec Kit converge against every requirement/scenario/task/principle; append and implement any gaps in specs/009-document-review/tasks.md before public review/merge.

## Dependencies and Parallel Opportunities
T001 -> T002/T003 -> T004 -> US1 -> US2 -> US3 -> verification. Within US1 media tests and transport tests can be authored independently; within US2 backend retry tests and frontend edit-persistence tests are independent. Within US3 documentation and visual tests can be prepared independently. Execute sequentially in this workspace to avoid shared edits. Each story requires its own independent test before being marked complete.

## Implementation Strategy
Test trust boundaries first, then processing without financial writes, then explicit atomic confirmation and durable mobile editing. Do not expose an incomplete recognition control or claim the entire2.0 release ready. Never contact a real processor or modify existing server infrastructure during development.
