# Validation evidence

2026-10-12: local checks on the implementation branch.

- 159 Pytest passed, including 18 scoped credential/API cases, 15 real protocol/transport cases, additive restart and archive upgrades001–005, malformed archive rejection and existing banking/notification/file regressions.
- Ruff static checks and formatting passed.
- 17 Vitest tests passed; TypeScript/ESLint/Prettier checks and production build passed. Lazy machine UI adds about3.9KiB gzip; entry remains129.1KiB/180KiB budget.
- All21 headless Playwright journeys passed in31.9seconds, including 360px issue/copy-once/manual fallback/dirty warning/offline/revoke/network error, explicit granted car names, preservation of a new secret while another key is revoked and secret absence from localStorage/IndexedDB. Dark/light screenshots inspected locally; generated test secrets are revoked, screenshots remain ignored.
- First25 history records from10000 events meet the one-second budget. Analytics above20000 explicitly rejects rather than returning truncated totals. Existing1000×10000 bank preview and domain analytics budgets retained.
- Concurrency checks cover same-operation retries and revoke/write transaction ordering; separate credentials have isolated receipt namespaces. Changed payload/stale version/foreign records/nested unknown fields fail without financial changes. Previous human odometer confirmation cannot approve a later machine correction.
- Period fuel calculations retain the pre-period full-tank boundary; metadata/private field projections exclude VIN/plate/authors/files/bank provenance. Backup restores revoke all machine keys and retain receipts/history; damaged verifiers/grants/receipt projections reject before replacement.
- STDIO modern2026-07-28/legacy2025-11-25 discovery/list/call and structured error paths, cancellation/EOF, malformed/batch/null-ID/oversized input, fixed URL, redirect/body/deadline/TLS and redaction checks use only synthetic local upstreams. No third-party user data or visible windows.

Initial Linux Docker CI38196012210 passed on3578f79. Convergence found C001 missing reminder completion, C002 scope names on key cards and C003 numeric-ID/legacy negotiation accuracy. T019–T021 implement these corrections with failing-first tests; reminder completion requires explicit actual date and fresh mileage, advances once, and creates no mileage or financial event. Protocol tests cover four concurrent requests, finite numeric IDs, legacy identity/negotiation and ping.

Tracked-source credential/runtime scan passed for223 files. Final corrected-head Linux Docker CI and a clean Spec Kit convergence are required before merge. This is an optional2.0 slice; the complete2.0 release is not claimed.

Final corrected head2538dbe passed Linux Docker/health CI38196743263. Second convergence assessed7FR/6SC/15acceptance scenarios/21tasks/12principles with zero remaining findings, leaving tasks byte-for-byte unchanged during assessment (SHA-2564CC53819A0C8164BEB1EF8783EBCEA71586E4682D0C31B6CB1F85B430049CB11). PR8 merged as e6933b8b1fe7b4942e0a9f06582422bf2c5e3646. T018 was closed afterward as implementation bookkeeping.
