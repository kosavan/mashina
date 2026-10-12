# Research decisions

Read-only architecture research delegated under Spec Kit plan; no bank/external request.

- Explicit CSV conventions avoid guessing bank formats. Restrict currency to RUB/EUR/USD two minor digits, exact Decimal; incoming/zero cannot create expenses.
- Content hash is not identity: legitimate equal purchases exist. Source UUID + bank ID deduplicates across cars; no-ID exact file/ordinal proves repeat, changed files produce an overlap hint requiring acknowledgment. Rejected unique-content identity would silently lose purchases.
- Immutable expiring batches avoid trusting changed client bank content. Mapped fields only, no raw files/sample cells; lazy expiry avoids workers. Bank data actor-private even for shared cars.
- Atomic live permissions and event-version revalidation; normal Store mutation for creates, provenance only for links. One-to-one links deliberate scope, no split payments.
- Preserve confirmed identities through deletion/restore; expire previews. Revision 005 must retain notification archive validation.
- Optional local mapping, no credentials/account-number fields, network adapters or global cross-user deduplication promise.

Test matrix: parser bounds/sign/date/precision; preview privacy; stable-ID retry/conflict; legitimate no-ID duplicates; fuel/service invariance; stale/deleted candidates; atomic rollback/concurrency; revoked/disabled/foreign/driver access; backup/legacy/notification checks; shared export privacy; 360 px review/offline/pagination; performance.
