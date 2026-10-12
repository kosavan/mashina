# Additive documents

TireSet optional fields:
- manufacture_code: four digits WWYY, week 01–53; future codes rejected; empty means unknown.
- tread_threshold_tenths: integer 1–200 or null. Form input tread_threshold_mm normalizes to exact integer tenths.
- tread_measurements: up to 200 objects; stable UUID id, measured_at YYYY-MM-DD (not future), depth_tenths integer 0–300, notes up to 500 characters. Form depth_mm requires at most one decimal. IDs unique per set; chronological sort retained.

Event optional fields: service_address up to 500 characters; service_latitude/service_longitude both absent or a finite decimal pair in ±90/±180. Canonical decimal strings preserve precision and accept zero coordinates. No external lookup during validation or persistence.

No SQL schema change. Existing IDs, row versions, owner ACL and outbox operation receipts remain authoritative. Backup/export carry the JSON fields. Financial event totals and confirmed mileage semantics are unchanged.
