# Tasks: MASHINA vehicle sharing

Execute sequentially; backend authorization precedes UI exposure. No delegated agents required.

- [x] T001 Define acceptance, policy matrix, architecture and contracts in specs/003-vehicle-sharing.
- [x] T002 Write failing role, account, replay, attachment and archive tests in backend/tests/test_access.py.
- [x] T003 Add additive 003 schema/backfill in backend/migrations/versions/003_sharing.py.
- [x] T004 Implement centralized transactional policy and scoped state/mutations in backend/access.py and backend/storage.py.
- [x] T005 Implement account/session/password and vehicle grants APIs in backend/app.py.
- [x] T006 Enforce attachment visibility and administrator archive access in backend/app.py and backend/backup.py; verify old/new restore.
- [x] T007 Add lazy tailored sharing/account/password UI in frontend/src/Sharing.tsx and capability-aware controls across views/forms.
- [x] T008 Prevent unauthorized offline projection, preserve blocked drafts, purge reports after scope changes in frontend/src/offline.ts and App.tsx.
- [x] T009 Add browser account-switch, driver quick-add and revocation workflows; run backend/frontend/browser/build checks.
- [ ] T010 Document local accounts, privileges, offline privacy limits and recovery; perform Spec Kit convergence and publish reviewed changes.


## Phase 2: Convergence

- [x] T011 Explain in the vehicle photo form that selecting a cover shares it with vehicle members (plan: deliberate cover visibility; FR-004).
