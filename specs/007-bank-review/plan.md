# Plan — MASHINA reviewed bank CSV

Existing React/TypeScript/Vite + FastAPI monolith, SQLAlchemy Core/SQLite transactions, exact money, session/CSRF. No new dependencies, network, worker or changes to financial schema. Existing CSV importer stays intact.

`backend/bank_csv.py`: typed pure parser/inspection, explicit encoding/delimiter/date/sign/currency, Decimal money. Inspection returns headers/count only. Raw CSV stays request-local, unmapped columns discarded. Maximum 2 MiB, 1000 rows, 50 columns, 2000 description characters, RUB/EUR/USD two decimals.

`backend/bank_import.py`: actor-private stable UUID sources, immutable mapped previews (1800 seconds, at most three active batches, lazy cleanup), candidate index by amount/currency ±3 days, maximum five candidates/count/version. Stable source/bank-ID identity excludes vehicle; no-ID exact-file-hash/ordinal proof, canonical fingerprint only overlap hint. Equal legitimate purchases allowed with explicit cross-file acknowledgment. No global deduplication across users.

`backend/bank_api.py`: Pydantic boundaries, authenticated owner-role endpoints, CSRF, bounded uploads. Commit accepts batch/row IDs and choices only; under one transaction rechecks actor/source/car rights, TTL, membership, target version/deletion/money/date, then creates via Store.mutate(connection=c) or links without changing money. Unique one-to-one event links. Any failed row rolls back all. Durable operation digest/result replay checks rights even after batch expiration.

Migration `005_bank_review.py`: four additive tables detailed in data-model.md, destructive downgrade refused. Backup validates relations/content, preserves ledger and commit receipts, expires previews; notification validation applies to both 004 and 005. Private export only, bank provenance never enters shared state, general exports, PDF, notification or audit text. Reviewed expense description is intentionally shared ordinary history.

Lazy `frontend/src/BankImport.tsx` in OwnershipTools Import: custom Russian mapping/review/confirmation, per-row unset/create/link/ignore, category/description, 50-row pages, currency-separated new sums, errors preserve choices. Online-only, no bank file in generic offline outbox. Demo identical isolated implementation; 360 px themes/a11y/safe-area and headless screenshots.

Tests first: parser/privacy, atomic create/link, stable-ID/no-ID identities, concurrency/RBAC, backup/legacy/export, Vitest selection helpers and mobile Playwright. 1000 rows × 10000 events under two seconds, entry bundle under existing 180 KiB, no polling. Full regression/Docker CI and Spec Kit converge before publication.

Constitution I–XII: exact atomic money; polished progressive UI; focused monolith; self-hosted; actor privacy/CSRF; mobile/a11y; explicit online requirement with existing offline unchanged; acceptance tests; typed/migrated modules; bounded lazy work; backup recovery; optional slice after verified 1.1. No design exception.
