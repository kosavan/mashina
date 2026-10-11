# HTTP contract (same origin, authenticated except bootstrap/login)

JSON bodies, decimal inputs encoded as strings. Errors `{detail: string}`.
Unsafe requests require `X-CSRF-Token` and matching Origin; cookies HTTPOnly/SameSite.

- GET /api/v1/session: authenticated user and csrf; 401 if expired.
- GET /api/v1/setup: whether initial admin exists; no secrets.
- POST /api/v1/setup: username/password/bootstrap_token; succeeds exactly once.
- POST /api/v1/login; POST /api/v1/logout.
- GET /api/v1/state: authorized vehicles/events/categories/reminders/attachments/settings.
- POST /api/v1/mutate: `{operation_id, entity, action, id, expected_version?, data}`;
  entity vehicle/event/category/reminder/settings; action create/update/delete/restore/complete.
  Success `{record}`; 409 version/ID reuse conflict; 422 invalid fields; 403 unauthorized.
  Server assigns authoritative amount_minor and validates all references.
- GET /api/v1/analytics?vehicle_id=&start=&end=&category=&kind=&currency=RUB:
  totals, month/category/year/car groups, observed mileage, fuel cycles, missing-data reasons.
- POST /api/v1/attachments: multipart file, vehicle_id, optional event_id and document metadata.
- PATCH /api/v1/attachments/{id}: metadata only; owner-scoped.
- GET /api/v1/attachments/{id}?download=1: authenticated bytes, no public paths.
- DELETE /api/v1/attachments/{id}: removes reference; file garbage retained until backup cleanup.
- GET /api/v1/export.json and /api/v1/export.csv: related IDs and data, CSV injection mitigated.
- GET /api/v1/backup: complete verified ZIP including database and files.
- POST /api/v1/restore: multipart archive; admin + CSRF; all-or-nothing validation/replacement.
  Invalidates sessions and requires login after successful replacement.
- GET /api/v1/health: readiness only, no personal information.

Offline: outbox retains full mutation until acknowledgment. 401 requests re-login without
discarding queue. 409 retains mutation and exposes keep-server or retry-on-current-version.
No protected API or attachment cache in service worker; snapshot is private IndexedDB.


