# Validation evidence

2026-10-12: local checks on the implementation branch.

- 157 Pytest passed, including 16 scoped credential/API cases, 14 real protocol/transport cases, additive restart and archive upgrades001–005, malformed archive rejection and existing banking/notification/file regressions.
- Ruff static checks and formatting passed.
- 17 Vitest tests passed; TypeScript/ESLint/Prettier checks and production build passed. Lazy machine UI adds about3.9KiB gzip; entry remains129.1KiB/180KiB budget.
- All21 headless Playwright journeys passed in30.5seconds, including 360px issue/copy-once/manual fallback/dirty warning/offline/revoke/network error and secret absence from localStorage/IndexedDB. Dark/light screenshots inspected locally; generated test secrets are revoked, screenshots remain ignored.
- First25 history records from10000 events meet the one-second budget. Analytics above20000 explicitly rejects rather than returning truncated totals. Existing1000×10000 bank preview and domain analytics budgets retained.
- Concurrency checks cover same-operation retries and revoke/write transaction ordering; separate credentials have isolated receipt namespaces. Changed payload/stale version/foreign records/nested unknown fields fail without financial changes. Previous human odometer confirmation cannot approve a later machine correction.
- Period fuel calculations retain the pre-period full-tank boundary; metadata/private field projections exclude VIN/plate/authors/files/bank provenance. Backup restores revoke all machine keys and retain receipts/history; damaged verifiers/grants/receipt projections reject before replacement.
- STDIO modern2026-07-28/legacy2025-11-25 discovery/list/call and structured error paths, cancellation/EOF, malformed/batch/null-ID/oversized input, fixed URL, redirect/body/deadline/TLS and redaction checks use only synthetic local upstreams. No third-party user data or visible windows.

Tracked-source credential/runtime scan passed for223 files. Linux Docker CI and final Spec Kit convergence are pending and must pass before merge. This is an optional2.0 slice; the complete2.0 release is not claimed.
