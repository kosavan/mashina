# Body damage API contract
Use authenticated cookie/CSRF `POST /api/v1/mutate` with entity `body_damage`, stable
UUID id/operation_id, action create/update/delete/restore, expected_version for edits.
Data follows [data model](../data-model.md). Owners may write; vehicle participants
may read condition and only authorized images. No machine API scope expansion.

`GET /api/v1/state` adds `body_damages`; older clients can ignore it. Frontend treats
missing field in old caches as an empty list, without changing IndexedDB format.
Responses follow existing record/can_edit/version envelope; replay returns the same
receipt, conflicting version 409, forbidden access 403, invalid input 422.

Existing `POST /attachments` uploads image with vehicle_id; linking does not change
its visibility. JSON/CSV include condition records; ZIP includes DB and referenced
files using existing consistent backup. Restore recognizes 001–007 and preserves
notification pause, machine credential revocation and session invalidation.
