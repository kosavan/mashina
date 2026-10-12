# Validation — bank review slice

## Local evidence, 2026-10-12

- 124 Pytest tests passed, including 23 pure CSV cases; exact amounts, parser bounds, atomic rollback, fuel/service unchanged on link, stable-ID cross-car repeat, legitimate equal no-ID purchases, explicit cross-file acknowledgment, duplicate event link, changed ID conflict, lost-response/concurrent receipt, expiry/three-batch cap, CSRF, actor/driver/admin/revoked/disabled access and isolated demo.
- Archive round-trip preserves confirmed bank records and receipt replay after preview cleanup. Tampered fingerprint, foreign source actor and invalid notification key are rejected before live replacement. True legacy schemas 001–004 migrate to 005. Existing attachments/offline/financial tests remain green.
- Worst matching fixture: 1000 rows against 10000 same-amount/same-day events passes two-second HTTP preview budget; each returns count 10000 but only five candidates. Date buckets avoid a 1000×10000 scan.
- 17 Vitest tests passed, including exact currency-separated new totals, no default choices and processed rows excluded from unresolved choices.
- TypeScript, ESLint, Prettier, Ruff and production build passed. Bank UI is a separate lazy chunk; entry gzip 129.1 KiB against existing 180 KiB budget.
- Two new headless 360 px journeys passed: actual fuel link + reviewed expense + lost response/retry + repeated file; 51-row pagination + preserved offline choices + stale match rollback + corrected confirmation. Dark/light screenshots inspected from ignored `.cache`, no horizontal overflow. Existing demo journey now also confirms a real isolated bank import.
- Full 20-test Playwright regression passed in 29.0 seconds. Expanded suite initially reached the real login throttle because a sharing test logged in twice; reuse of its authenticated setup session fixed the fixture without changing application limits. Linux Docker CI remains required below. No visible window, bank request or infrastructure change used.

## Traceability

| Intent | Evidence |
|---|---|
| FR-001/002, US1, SC-001 | bank_csv.py, test_bank_csv.py; bounded header-only inspection and mapped immutable batches |
| FR-003, US2, SC-002 | bank_import.py; fuel/service bytes/version unchanged; exact single created expense and no inferred odometer |
| FR-004, US3, SC-003 | transaction/unique ledger/operation digest; stale/atomic/concurrent/replay/no-ID tests |
| FR-005, US3, SC-004 | bank_archive.py, backup.py; 001–004 legacy migration, private export/permissions and corruption tests |
| FR-006, US4, SC-005 | lazy BankImport.tsx, bankReview helpers, bank-review.spec.ts and demo app.spec.ts; mobile/online/visible errors |
| SC-006, Constitution X | same-amount/day performance fixture, date bucket index, five-candidate/50-row limits and entry budget |

## Limits

No global deduplication across private sources/users; no-ID changed files only overlap warnings.
Only signed CSV and RUB/EUR/USD, no split payments/refunds, no bank network. Bank review is
online-only and memory-only in browser. Expiry is access control plus lazy cleanup, not a
background deletion timer. Full backups include private bank metadata. Actual iPhone hardware
and production deployment remain owner-environment checks; no unsupported claim made.

## Publication

Source-only secret/runtime scan passed for 203 tracked files. [PR 7](https://github.com/kosavan/mashina/pull/7), code commit d405ca4, passed [Linux CI 38192547172](https://github.com/kosavan/mashina/actions/runs/38192547172), including all 20 browser journeys, Docker build and container health/persistent initialization.

Final review makes blocked/invalid rows explicit in both review and confirmation totals and warns before closing any selected file, including mapping-only drafts. Vitest/static/build and both affected mobile journeys passed again, including cancelling the close warning without losing choices. [CI 38192877908](https://github.com/kosavan/mashina/actions/runs/38192877908) passed on f7da2f5, including Docker health. Network-error wording is Russian and the lost-response journey checks it explicitly. Final code 41bb8ce passed [CI 38193230068](https://github.com/kosavan/mashina/actions/runs/38193230068), including all backend/frontend/browser checks and Linux Docker initialization.

Spec Kit convergence checked 6 FR, 6 SC, 11 acceptance scenarios across four stories, 15 tasks, the plan architecture/privacy/performance decisions and all 12 constitution principles: zero missing/partial/contradictory/unrequested findings. Convergence itself left tasks.md unchanged; task completion/evidence was recorded afterward. No extension hooks registered. PR 7 merged after exact-head checks passed. The closure documentation accompanies the next independently specified slice; this bank slice does not constitute all of release 2.0.
