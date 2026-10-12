# Contracts

Existing `/api/v1/mutate` envelope is unchanged: operation_id, id, entity, action, expected_version, data. New tire fields are validated for entity tire_set; service location fields for entity event. Replaying a stable operation returns the same record; stale updates conflict normally.

`GET /api/v1/state`, JSON exports and full backups include the optional fields. Driver read/write restrictions use existing entity gates; this feature grants no new permissions. Validation errors retain the normal safe API error response.

Maps are a client opt-in HTTPS iframe to the fixed OpenStreetMap host, never a user-supplied executable URL. Address/coordinates are React-escaped. Browser acceptance tests intercept the provider only after the explicit request and assert zero requests before it.

No OCR route, geocoding route, machine write permission or new external background task is added.
