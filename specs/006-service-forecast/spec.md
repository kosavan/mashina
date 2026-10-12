# MASHINA 1.1 — known maintenance cost forecasts
**Branch** codex/mashina-service-forecast | **Date** 2026-10-12

## User stories
### US1 — Optional service estimate (P1)
An owner enters an expected price/currency on an existing maintenance reminder, including offline.
1. Empty estimate means unknown, not zero; exact nonnegative money and three-letter currency are validated. Explicit zero is distinct from unknown.
2. Edit/clear preserves reminder date/km/repeat settings and actual vehicle financial history. Driver cannot change reminders.
3. Old reminders/backups without estimates continue working; stored estimates survive backup and restore.
### US2 — Honest planning (P1)
The owner sees known service estimates alongside regular payments in the existing twelve-month forecast.
1. The next incomplete, enabled reminder with a date within the selected twelve-month range contributes once. No future recurrence is invented until completion advances the actual reminder.
2. Mileage-only and overdue/undated estimates appear separately with their actual threshold; no invented date or measured future odometer. A combined date/km reminder labels its calendar date as a deadline that may occur earlier by mileage.
3. Unknown costs explicitly say price not set. Planned values never enter actual expense totals/budgets/cost per km; currencies remain separate.
4. Completed, disabled/deleted and other-vehicle reminders do not enter forecast; completion/reschedule/edit refresh the next forecast correctly. A repeated cycle retains only repeating deadline criteria; date-only completion needs no odometer, kilometre repetition requires explicitly confirmed odometer.
### US3 — Finished mobile experience (P1)
Optional advanced fields in the existing reminder form; clear Russian planning labels and mobile cards.
1. 360px dark/light controls work, no horizontal scroll, errors/empty/offline states remain useful.
2. Isolated demo demonstrates real estimate behavior with synthetic data. Offline draft survives reload and syncs once.

## Functional requirements
- FR-001 Optional exact estimated_cost_minor and cost_currency on Reminder, typed UI and server validation; unknown is null.
- FR-002 Next known dated service occurrences in bounded12-month forecast, separate from regular payments and actual expenses.
- FR-003 Mileage-only/out-of-period and unknown service estimates remain readable without invented dates/amounts.
- FR-004 Existing RBAC, idempotent offline queue, migration/backup compatibility and actual totals preserved.
- FR-005 Finished mobile form/forecast and isolated demo, no external dependencies.

## Success criteria
- SC-001 1234.56 becomes123456 minor units; blank removes estimate, zero retained; negative/nonfinite/excess precision rejected.
- SC-002 Date/km/combined/completed/disabled/deleted/other-car/period boundaries verified; no premature recurrence or duplicate cost.
- SC-003 Backup roundtrip and offline-to-online save preserve estimate with one reminder and no financial event.
- SC-004 Browser verifies 360px edit/clear/planned labels; all existing checks pass.

## Scope
Only the next service occurrence is known: repeat interval advances when confirmed completed. No technical-condition prediction, repair guessing, AI, exchange rates or new financial records. Date horizon is [selected month, month+12). Mileage-only estimates cannot be added to dated monthly totals. Existing JSON record extension is backward compatible and requires no physical schema change.
