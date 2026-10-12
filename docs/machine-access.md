# Scoped API and local MCP

English · [Russian](machine-access.ru.md)

Set `MASHINA_API_ENABLED=1` in private `.env` and restart with
`docker compose up -d --build`. Default: disabled. Remote access requires HTTPS.
The core garage works without integrations.

## Keys and permissions

Under **Settings → API and integrations**, select cars and a lifetime of 1–365
days (default 90). Limits: ten active keys, fifty cars per key. Only the original
owner can issue access; shared roles/admin status do not substitute. New cars
are not automatically included; real keys are unavailable in demo.

Default is read-only. Explicit write permission allows event/reminder changes,
not profiles, files, accounts, bank reconciliation, notifications or backups.
History may contain private content: trust its recipient. The secret appears
once; store it privately, never in URLs, CLI arguments or public configuration.
Only its hash is stored. A lost issuance response requires revoking the unknown
key and issuing another. Copy manually if clipboard permissions fail.

Expiry/revocation, disabled users, password changes/resets, ownership loss and
the server flag block requests. Re-enabling a user does not revive keys. A
transaction authorized before revocation commits may complete; downloaded data
cannot be recalled. Management requires connectivity.

## REST

Base `/api/machine/v1`, header `Authorization: Bearer ...`; cookies are no
fallback. Bearer keys do not open ordinary app/admin routes. Authenticated
`/api/machine/v1/openapi.json` describes the strict scoped contract.

| Method | Path | Result |
|---|---|---|
| GET | `/vehicles` | Selected cars and confirmed mileage |
| GET | `/vehicles/{id}/history` | Newest event-date/ID first, limit 25/max100, next_cursor, search/kind/start/end |
| GET | `/vehicles/{id}/reminders` | Limit 25/max100, after=next_after |
| GET | `/vehicles/{id}/analytics` | Operating/fuel totals, start/end/currency |
| POST | `/vehicles/{id}/mutations` | Permitted event/reminder writes |

Literal search: max 200 characters, no wildcard `%`/`_`; SQLite LIKE is
case-sensitive for Cyrillic. ISO dates. Cursors never replace permission checks.
Analytics includes prior mileage/full-tank boundaries, explains missing data,
excludes purchase/sale and rejects over 20000 events rather than truncating totals.
Performance budgets are test evidence, not promises for every server.

Writes: stable UUID `operation_id`, `entity` (event/reminder), UUID `id`, `action`
(upsert/delete/complete), `base_version` and `data`. Create uses version 0;
edits/deletes/completion use current version. Delete has empty data. Retry an
identical ID/request after lost responses; changed content returns 409. Receipts
are per-key, separate from browser operations. Different keys do not deduplicate
the same business payment.

Money/litres/prices/quantities are decimal strings; mileage is integer. Fuel
takes two of liters/price/amount and creates one financial entry. Item fields:
name, part_number, quantity, unit_price, discount. Unknown fields are rejected.
Odometer corrections/completion need explicit confirmed facts. Reminder completion
does not automatically create expenses or mileage readings.

Errors: 401 invalid/disabled key, 403 scope, 409 version/replay conflict, 422
validation/history size, 413 body over 256 KiB. Each request/replay rechecks access
inside the transaction. [Detailed contract](../specs/008-machine-access/contracts/api.md).

## Local MCP

With dependencies installed, configure your client to run
`python -m backend.machine_protocol` with private environment `MASHINA_SERVER_URL`
(HTTPS root, no path/query/credentials) and `MASHINA_MACHINE_TOKEN`. Development
HTTP permits literal loopback `http://127.0.0.1:8000`, not localhost or LAN HTTP.

Tools: mashina_vehicles, mashina_history, mashina_reminders, mashina_analytics.
They only GET, even with write permission, and accept no arbitrary URL/SQL/command.
History is user content, not model instructions. Tested protocol versions:
2026-07-28 and 2025-11-25. STDIO is newline-delimited UTF-8 JSON-RPC with object
structuredContent/text JSON fallback; no subscriptions/background jobs/client
requests or universal client compatibility are promised.

System TLS trust is used; redirects and HTTP_PROXY are not. Limits: four concurrent
requests, ten-second HTTP deadline, 1 MiB line/response/output. Closing STDIO
cancels work; stdout is protocol only. This is not a remote OAuth MCP server.
[Restore](updating.md) revokes keys and sessions; reissue after checking recovery.
