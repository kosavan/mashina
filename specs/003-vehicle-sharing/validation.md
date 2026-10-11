# Validation: vehicle sharing

- Backend: 33 pytest tests pass, including the role/authorship matrix, identity spoofing, cross-car moves, receipt replay after revocation, upload revocation during async read, private/shared/cover files, account disable/password rotation and multiuser restore.
- Migration: a genuine 001 snapshot (WAL closed/checkpointed, new columns removed) upgrades to 003, preserving the original vehicle/event author and administrator. Existing rollback-on-failed-migration test remains green.
- Frontend: 9 Vitest tests pass, including permission checks before offline projection; TypeScript, ESLint and Prettier pass.
- Browser: 12 Playwright journeys pass, including local account creation/grants through UI, driver access, offline revocation, preserved blocked draft, account switching and primary 360px regressions.
- Production frontend build passes; entry gzip ~128 KB within 180 KB budget. Sharing is a separate lazy chunk (~3 KB gzip).
- Mobile sharing screenshots inspected; panel content spacing corrected. Screen remained off; all browsers headless.
- Spec Kit convergence found one missing cover-visibility explanation (T011); implemented. No remaining product gaps in this feature's stated scope. Full release 1.1 still needs sale PDF and optional notifications.
- No extension hooks configured. Linux container/CI validation is required before merging the published PR.
