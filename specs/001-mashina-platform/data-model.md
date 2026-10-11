# Data model

Schema version 1. UUID identifiers; ISO event dates/timestamps; integer versions.
JSON payloads are validated per type, indexed relational envelope carries ownership.

- User: id, unique username (3–64), Argon2id hash, settings JSON (theme/locale/units).
- Session: hash of random token, user_id FK, CSRF token, expiration (7 days).
- Vehicle/VehicleAccess: owner_id FK, version, JSON profile; name 1–100 chars,
  purchase_odometer integer 0–3000000, year 1886–next year, status active/archived/sold;
  optional purchase/sale amount integer cents, currency ISO-style three uppercase letters,
  VIN/registration/drivetrain/fuel and image attachment ID.
- Event: vehicle_id FK, owner_id FK, kind expense/fuel/maintenance/odometer/note,
  occurred_at ISO datetime, version, soft-deleted, amount_minor integer >=0,
  currency, payload JSON. One financial envelope for each domain operation.
  Fuel: liters/price decimal strings >0, full/gap flags, fuel/station. Maintenance:
  service parts encoded as items with name, part_number, quantity, unit_price,
  discount; item cents = round(quantity*unit_price - discount), total plus adjustment.
  Odometer is integer 0–3000000. Anomaly requires confirmed flag.
- Category: owner FK, name 1–80, parent FK (same owner, acyclic).
- Reminder/MaintenanceSchedule: vehicle FK, title 1–120, due_date and/or due_odometer,
  warning_days/km nonnegative, repeat_days/km, enabled, completed_at, version.
  Done advances repeat limits from confirmed completion date/odometer; disable does not delete.
- Document/Attachment: owner/vehicle FKs, optional event FK, generated filename, original
  name, media_type, SHA256, byte size, document type/title/issued/expires/notes.
- AuditRecord: owner, entity, action, timestamp, before/after JSON. No password/session hashes.
- Receipt: owner + operation_id unique, request SHA256, response; same payload repeats
  response, different payload with same operation_id is conflict.
- TimelineEvent/OdometerReading/Expense/FuelEntry/MaintenanceRecord are validated views
  of Event; ServicePart/ExpenseItem are owned items; no second expense from fuel/TO.

Current odometer is maximum of purchase reading and active confirmed dated readings.
Corrections remove old reading through versioned update, never implicit max stored forever.
Period mileage uses latest confirmed readings on/before interval endpoints; no interpolation.
If no start baseline, show unavailable. RUB and other currencies never silently mix.
Full-to-full fuel cycle excludes opening fill, includes subsequent partial and closing fill;
gap or changed fuel resets baseline; non-increasing mileage cannot produce consumption.

Transitions: vehicle active ↔ archived/sold; event active ↔ soft-deleted (undo);
reminder enabled → completed/repeated or disabled; all updates require expected_version.


