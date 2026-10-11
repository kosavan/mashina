# Research decisions

Research delegated by the plan skill on 2026-10-11; conclusions reviewed before design.

- **Decision**: FastAPI + SQLite + local files, one worker and short transactions.
  **Rationale**: personal server, simple deployment, no queue/database daemon.
  **Alternatives**: PostgreSQL and background workers add unnecessary operations.
  Foreign keys enabled per connection, parametrized SQL and explicit transactions.
  Sources: https://docs.python.org/3/library/sqlite3.html and https://sqlite.org/foreignkeys.html
- **Decision**: SQLite WAL (patched SQLite 3.51.3+), FULL sync, busy timeout.
  **Rationale**: pin a patched SQLite runtime and use the backup API for consistent snapshots.
  **Alternatives**: rollback journaling is simpler but has lower read concurrency.
  Source: https://sqlite.org/wal.html
- **Decision**: integer minor units, Decimal from strings, ROUND_HALF_UP per item and total.
  **Rationale**: exact cents, deterministic discount/fuel arithmetic, currencies separated.
  **Alternative**: binary floats introduce financial drift.
  Source: https://docs.python.org/3/library/decimal.html
- **Decision**: Argon2id and opaque server-side sessions, HTTPOnly SameSite cookies,
  CSRF token and same-origin checks; setup bootstrapped with a local CLI token.
  **Rationale**: prevent first-visitor account takeover and token exposure.
  **Alternative**: localStorage JWT adds lifecycle and XSS risk.
  Sources: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
  and https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- **Decision**: authorize every file, generated names; decode/re-encode image uploads,
  PDF inline in sandbox and arbitrary files download-only; size limits and no SVG/HTML preview.
  **Alternative**: public upload folder violates privacy.
  Source: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- **Decision**: backup under mutation lock using sqlite backup, referenced files and SHA-256;
  restore validates schema, integrity, foreign keys and every file before atomic replacement.
  **Alternative**: copying a live database and independent directory can lose data.
  Source: https://sqlite.org/backup.html
- **Decision**: service-worker app shell; user-scoped IndexedDB snapshot + outbox written
  together; foreground online/focus/retry synchronization. Transactional receipt keyed
  by owner and operation UUID plus payload hash, optimistic expected_version conflicts.
  **Rationale**: repeat delivery must never double-count. Background Sync optional, not promised.
  Sources: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
  and https://webkit.org/blog/14403/updates-to-storage-policy/


