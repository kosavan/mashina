# Reviewed bank CSV imports

English · [Russian](bank-import.ru.md)

**Maintenance → Import → Review statement** is optional and local, also in demo.
No bank login, card number or paid API is used. Original files are not retained.
Use a copy and select only vehicle-related payments.

## Format and review

UTF-8 with/without BOM or explicitly selected Windows-1251; comma, semicolon or
tab. Limits: 2 MiB, 1000 rows, 50 columns. Headers must be unique/nonempty and row
widths match. Standard CSV quoting works. Map date, signed amount and description;
optional stable bank ID/currency. Choose DD.MM.YYYY or YYYY-MM-DD and expense sign.
Exact two-decimal RUB/EUR/USD accepts dot/comma and valid space-grouped thousands.
Currencies are not converted/combined. XLSX/PDF, separate debit/credit, refunds
and transfers are unsupported; incoming/zero rows may only be skipped.

1. Select car/file/encoding/separator. Header inspection returns only headers
   and row count, without unrelated bank field examples.
2. Map columns and select a private source. Reuse it for the same account;
   a label needs no account details.
3. Review identical amount/currency matches within three days: five closest
   candidates and full count, without automatic selection.
4. Create, link or skip. Linking changes no existing entry or money. A row links
   to one entry; splitting a payment is unsupported.
5. Confirm the selected set. Stale matches, revoked access or errors abort the
   entire set; decisions remain on screen for correction/retry.

Descriptions become shared vehicle history; remove private details first.
Source, bank ID and selected bank fields remain private to the importing user.

## Replay protection and privacy

Stable IDs are scoped to a private source, independent of car. Replay does not
recreate an expense even after deleting its linked entry. Changed facts with the
same ID conflict. Without IDs, only identical file bytes and row position prove
a replay; similar facts in another file require explicit confirmation because
identical purchases can be real. Reordering/re-encoding also changes file identity.
Sources/users are isolated; do not create new sources to bypass warnings.

Mapped previews last 30 minutes, up to three active per user, cleaned on the next
review without background polling. Browser IndexedDB does not retain statements
or decisions; closing/reloading loses unconfirmed drafts. Review/commit require
connectivity; sync ordinary queued records first.

The confirmation ledger downloads privately inside the tool; shared exports,
sale reports and notifications exclude it. Full administrator backups include
private confirmations. Restore preserves confirmations but invalidates previews
and sessions, pausing notifications. Migration 005 is additive; follow the
[update guide](updating.md) for backups and rollback.
