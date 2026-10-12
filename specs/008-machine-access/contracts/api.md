# Contracts

## Browser: cookie session, CSRF writes

- GET `/api/v1/machine/credentials`: enabled flag and masked metadata (id/label/timestamps/write_enabled/vehicle_ids); demo disabled.
- POST same path: `{label,vehicle_ids,expires_days:90,write_enabled:false}`; original-owned cars only, max50 cars/max10 active keys/max365 days. Response metadata plus secret once. No-store.
- DELETE `/{id}`: own key revoke, idempotent. No scope edit/secret retrieval. Online only.

## Bearer REST: `/api/machine/v1`

No browser session fallback. 401 invalid credentials, 403 insufficient grant, 409 version/payload conflict, 422 invalid input. OpenAPI at `/openapi.json` describes only this namespace.

- GET `/vehicles`: live granted summaries id/version/name/brand/model/year/status/currency/purchase_odometer/current_odometer. No VIN/plate/notes/photos/ownership/financial acquisition details.
- GET `/vehicles/{id}/history`: limit25/max100, cursor, search≤200 literal chars, known kind, ISO start/end. Newest occurred_at/id; `{items,next_cursor}`. Projection includes ordinary event id/version/vehicle_id/kind/date/currency/description/odometer/category/amount/items/fuel/vendor/payment/tags fields, never arbitrary extensions, author identities, file IDs or bank provenance. Items: name/part_number/quantity/unit_price/discount/amount_minor.
- GET `/vehicles/{id}/reminders`: projected bounded paginated reminders, no service-cost extensions/documents.
- GET `/vehicles/{id}/analytics?start=&end=`: existing exact analytics with missing-data indicators and complete authorized history input. Above20000 explicit error.
- POST `/vehicles/{id}/mutations`: `{operation_id,entity:event|reminder,id,action:upsert|delete|complete,base_version,data}`; write grant required, recursive field allowlist. Shared domain validation/version semantics. `complete` requires an existing reminder/current version and explicit `completion_date` not later than today; repeating mileage requires a fresh `completion_odometer` in this operation. No trusted correction/completed flag, cached reading or invented odometer event. Projected record/status only. Same key/op/payload replays, changed payload409, independent keys independent namespaces.

Never exposes state/files/accounts/credentials/bank/notifications/backups/admin. Readable ordinary text may contain personal details entered by owner; disclose before key issue.

## STDIO

`python -m backend.machine_protocol`, private environment MASHINA_SERVER_URL/MASHINA_MACHINE_TOKEN. Fixed verified HTTPS server or literal loopback HTTP, no redirects/proxies, ten-second deadline,1MiB frames/responses,four in-flight tasks. No credentials in arguments/logs.

Tools mashina_vehicles/history/reminders/analytics map only GET routes and strict bounded filters. No URL/path/SQL/write tools. Domain failure isError:true; invalid methods/arguments protocol errors. Notifications have no response. Versions2026-07-28/2025-11-25 only; modern params._meta version/clientCapabilities, discover complete supportedVersions/capabilities/ttlMs/cacheScope and serverInfo metadata. Modern list/call resultType complete. Legacy initialize/initialized with legacy result shape. Cancellation/EOF suppress late responses. Official references in research.md.
