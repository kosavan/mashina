# Tasks — notification slice
Sequential vertical slices; no real external sends during implementation.
## Phase1 — foundation
- [x] T001 Specify consent/privacy/delivery semantics and research/plan/contracts in specs/005-notifications.
- [x] T002 Add locked pywebpush/filelock and migration004 private identity/preferences/subscriptions/link/ledger tables; update backup validation/paused restore and true legacy migration tests.
## Phase2 — US1 Push
- [x] T003 Write failing default-off, auth/SSRF/key and private-key backup tests in backend/tests/test_notifications.py.
- [x] T004 Implement persistent key generation, bounded own subscription/status API and pinned safe transport in backend/notifications.py; register module in app.py.
- [x] T005 Add lazy Russian consent/setup/mobile sheet in frontend/src/Notifications.tsx, generic SW push/click handling and logout device cleanup.
## Phase3 — US2 Telegram
- [x] T006 Test and implement hashed one-time private chat linking, bounded optional update reception and fixed secret-safe Bot API in notification module/CLI.
## Phase4 — US3 dispatch
- [x] T007 Write failing fixed-clock stage/cycle/dedupe/claim/revoke/failure/retry tests.
- [x] T008 Implement bounded explicit CLI dispatch, atomic ledger, current-owner checks, status/retry/expiry logic and restore interprocess guard.
## Phase5 — verification
- [x] T009 Add headless browser and service-worker tests, 1000-reminder budget, privacy/output checks and backup/legacy regression.
- [ ] T010 Document optional setup/timer/secrets/external disclosure/recovery; run all checks and Spec Kit convergence; scan/publish PR and merge only on green CI.
