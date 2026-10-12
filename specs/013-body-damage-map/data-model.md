# Data model
`body_damages`: id UUID PK; owner_id users FK; vehicle_id vehicles FK; version positive;
data JSON text; deleted 0/1. Indexed owner_id/vehicle_id. New revision 007, no edits to 001–006.

Canonical JSON fields:
- title required, 1–120 trimmed characters; notes 0–4000.
- view front/rear/left/right/top; panel from the matching view's fixed panel set.
- x/y finite normalized 0–1 coordinates rounded to four decimals.
- damage_type scratch/dent/chip/corrosion/crack/other.
- severity minor/moderate/major, explicitly owner assessed.
- status observed/needs_repair/planned/repaired/monitoring.
- discovered_on valid ISO date, not future; odometer null or integer 0–3000000.
- repaired_on optional valid ISO date, not future or before discovery.
- maintenance_event_id optional UUID: same-car maintenance. Deleted references can
  remain as history but new links must be active; removed links can always be cleared.
- estimate_minor optional nonnegative integer minor units; currency three-letter code.
  Input estimate string is converted exactly; no aggregation into actual expenses.
- photos array max20 unique IDs: attachment_id UUID and phase before/after.
  New references must resolve to authorized same-car images. Missing prior evidence
  may remain as an unavailable historical reference or be removed.
- status_history server-only array of {status, changed_at, repaired_on}; append on create
  and status change, never trust submitted replacements. UI labels offline status as pending.

Stable operation IDs, expected_version, soft delete/restore and audit follow current
mutation semantics. Damage odometer does not join events or change current mileage.
Archive validation rejects malformed records and foreign-car/cross-owner links; missing
historical evidence after explicit deletion is allowed and displayed honestly.
