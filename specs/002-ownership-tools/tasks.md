# Tasks: MASHINA 1.1 ownership tools
## Phase 1: Foundation
- [x] T001 Write ownership validation, import and migration/restore tests in backend/tests/test_ownership.py.
- [x] T002 Add schema revision 002 and versioned owner-scoped entity mutations in backend/migrations/versions/002_ownership.py and backend/storage.py.
- [x] T003 Support verified restore of both 001 and 002 archives in backend/backup.py.
## Phase 2: Tires and parts — US1/US2
- [x] T004 Implement interval validation and derived parts in backend/ownership.py.
- [x] T005 Build bespoke tire cards, history editor and searchable parts source links in frontend/src/OwnershipTools.tsx.
## Phase 3: Budgets and forecast — US3
- [x] T006 Implement exact budget comparisons and 12-month recurring projections in backend/ownership.py.
- [x] T007 Build budget/recurring forms, cards and clearly labelled forecast in frontend/src/OwnershipTools.tsx.
## Phase 4: CSV — US4
- [x] T008 Implement bounded CSV preview, selected commit and stable import receipts in backend/ownership.py and backend/app.py.
- [x] T009 Build preview/errors/selection/confirmation UI in frontend/src/OwnershipTools.tsx; document format.
## Phase 5: Verification
- [x] T010 Extend offline projections/types and isolated demo in frontend/src/offline.ts, types.ts and backend/demo.py.
- [x] T011 Verify mobile journeys, duplicate CSV, migration/restore and unchanged financial totals; run convergence.
- [ ] T012 Document usage, update validation and publish reviewed feature to GitHub.

Dependencies: tests → migration/validators → per-story UI/API → offline/demo → regression/convergence/publication.
Each story has its independent acceptance in spec.md. Shared files edited sequentially.
