# MASHINA 2.0 — reviewed bank CSV import
**Branch**: codex/mashina-bank-review | **Date**: 2026-10-12 | **Status**: specified

## User stories and acceptance
### US1 — Deliberate local mapping (P1)
An owner uploads a bank CSV, chooses the relevant car, maps columns and explicitly selects outgoing sign convention.
1. UTF-8/UTF-8 BOM or explicitly selected CP1251, comma/semicolon/tab CSV, max2MiB/1000 rows/50 columns. Date, amount, description required; transaction ID/currency optional. ISO dates and DD.MM.YYYY supported; no guessed bank profile or network connection.
2. Inspection returns headers/count only, without sample cells. Preview retains an actor-private immutable mapped batch for 30 minutes, maximum three active batches per actor; no financial events, confirmed receipts or original file. Unmapped account/card/balance columns are discarded.
3. Exact positive expense from chosen debit sign; incoming/zero/malformed/ambiguous data is explained and cannot become an expense. Different currencies remain explicit; optional currency default is deliberately selected.
### US2 — Review every financial decision (P1)
The owner sees existing financial events with the same currency/amount within three calendar days and chooses create, link-existing or leave-unselected.
1. Rows are unselected by default. No automatic match or expense; exact candidate values and event kind/date/description visible, no private documents. A confirmed link records provenance without changing the existing fuel/maintenance/expense or counting cost again.
2. Create adds one ordinary expense using existing exact domain model, no odometer guessing. User sets category; selected account is never stored or accessed.
3. Commit accepts immutable batch/row IDs and explicit choices, never replacement bank content. Revalidate permission, expiry and linked event version/amount/currency/date/vehicle/deleted status. Any invalid selected row aborts all writes. One-to-one event links only; explicit ignore records no money, unselected writes nothing.
### US3 — Durable duplicate safety (P1)
Repeating the same export or concurrent confirmations do not duplicate money.
1. Actor-private sources have stable UUIDs and labels. Identity is source UUID plus bank transaction ID, independent of car. Without ID, exact file hash plus row ordinal proves exact repeat; canonical mapped fingerprint only suggests cross-file overlap.
2. Changed content under the same bank ID conflicts. Legitimate equal no-ID purchases can both exist; matching cross-file fingerprints require explicit separate-operation acknowledgment before create/link. Deleted targets remain processed, never recreated automatically. Same operation ID with different decisions conflicts.
3. Sources, confirmed ledger and commit receipts survive restore; pending previews expire. Separate actor-private export contains provenance. General shared state/export/PDF/notifications contain no bank source or transaction IDs. Drivers, other actors, revoked/disabled users and admins without car access cannot inspect/import. No global bank deduplication claim across separate actors/sources.
### US4 — Finished mobile review (P1)
The existing service Import tab contains an optional bank CSV review flow alongside the existing documented CSV importer.
1. Russian custom sheet/cards, touch controls,360px dark/light, accessible mapping labels and designed loading/empty/errors/confirmation. Large previews paginated50 rows, candidate list bounded5 with truncation notice. Errors cannot silently disappear.
2. Offline explains online-only file review/commit; no fake success or file loss promise. Isolated demo can exercise the same local implementation and never reaches real history or banks.

## Functional requirements
- FR-001 Bounded local CSV inspection/mapping, explicit encoding/debit convention/default currency and no bank network/API.
- FR-002 Exact normalized outgoing rows and clear validation/ambiguity errors; ignored columns/raw file not persisted.
- FR-003 Live candidate matching and explicit create/link decisions; unchanged original financial events on link.
- FR-004 Atomic confirmation and durable identity/content receipts, concurrency-safe and no silent overwrites/recreation.
- FR-005 Owner-only car scope, CSRF, audit, additive migration005, legacy001–004 restore and current export integrity.
- FR-006 Finished responsive Russian review, bounded pagination and isolated demo/online requirement.

## Success criteria
- SC-001 Parser sign/date/encoding/CSV/precision/currency/bounds tested; preview retains only bounded mapped batches and makes no financial change.
- SC-002 Linking fuel/service never increases cost; creating a new reviewed row increases exact amount once; currencies separated.
- SC-003 Repeat/concurrent batches, changed same-ID row, invalid linked candidate and revoked access verified; failed batch leaves no writes.
- SC-004 Backup/legacy migration/export preserve receipts and history; repeated import after restore stays idempotent.
- SC-005 Headless360px review mapping→link/create→repeat, loading/error/offline and unchanged actual costs; full regression and container CI green.
- SC-006 Preview1000 rows against10000 events budget<2sec in documented test fixture, bounded returned candidates and no quadratic database requests.

## Scope
Manual CSV mapping supports signed-amount exports, not bank login, separate debit/credit columns or XLSX/PDF. Incoming/refund reconciliation is outside this expense-only slice. Explicit ISO/Russian date format and outgoing sign are required. RUB/EUR/USD have two minor digits; description maximum 2000 characters. Source UUID scopes identity; labels are not credentials. No-ID changed exports require review of overlap warnings. User selects car-related rows; no bank connection or background process.
