# Tasks: local sale report
Execute sequentially; no UI entry point before protected PDF and privacy tests.
- [x] T001 Define report/disclosure acceptance and architecture in specs/004-sale-report.
- [x] T002 Add pinned runtime PDF dependency, dev extractor and local licensed fonts/provenance in backend/assets/fonts and uv.lock.
- [x] T003 Write failing privacy, role, exact-finance, chronology and long-history tests in backend/tests/test_reports.py.
- [x] T004 Implement allowlisted transactional snapshot and bounded in-memory render in backend/reports.py; owner-only endpoint in app.py.
- [x] T005 Add lazy mobile preparation sheet and disclosure toggles in frontend/src/SaleReport.tsx and Views.tsx.
- [x] T006 Verify browser download, error/driver states, 200-work budgets, fonts and pagination; render/inspect representative PDF pages.
- [x] T007 Document report privacy/limits, run complete regression and Spec Kit convergence; scan/publish source and merge only after CI.
