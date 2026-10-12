# Tasks — maintenance estimates
## Phase1 — foundation
- [x] T001 Specify estimate/period/unknown/recurrence rules, research and contracts in specs/006-service-forecast.
- [x] T002 Write failing exact estimate, dated/km boundaries, completion and backup tests in backend/tests/test_service_forecast.py.
## Phase2 — US1 estimates
- [x] T003 Add canonical optional estimate validation in backend/domain.py; typed advanced fields in frontend/src/Forms.tsx and types.ts.
- [x] T004 Implement and unit-test exact offline estimate/clear/completion projection; require explicit historical km when repeating by km.
## Phase3 — US2 honest planning
- [x] T005 Add next dated service estimates to ownership_report and preserve separate undated/unknown/deadline display in frontend/src/OwnershipTools.tsx.
- [x] T006 Correct backend repeat-cycle deadlines and match offline semantics; actual financial history stays unchanged.
## Phase4 — US3 polish and verification
- [x] T007 Add isolated demo estimates and headless360px offline/edit/clear/forecast journeys.
- [ ] T008 Document no-schema-change compatibility, money/period semantics and evidence; run checks/convergence, scan/publish PR and merge on green CI.

Dependency order: T001 → failing testsT002 → independent backend/UI validationT003 → projectionT004 → reportT005/cycleT006 → browser/demoT007 → verificationT008. Backend-only and UI-only tasks could run independently after contracts, but shared files are edited sequentially here. Each story is independently testable using its acceptance scenarios; no further project setup or dependencies required.
