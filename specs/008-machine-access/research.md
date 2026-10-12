# Research decisions

## Authentication and writes

Decision: separate `/api/machine/v1` bearer namespace; session-only key management with CSRF, demo denied. `MASHINA_API_ENABLED=1` read on startup, restart applies flag changes. Original ownership, active user, expiry, revocation, permission and explicit car grant are checked inside every read/write/replay transaction. Requests authorized before revoke commits may complete; later authorizations fail. Delegated ownership cannot issue grants. Session-equivalent API tokens were rejected because they expose unrelated domains.

Decision: recursive extra-forbid inputs and explicit output projections. Ordinary descriptions/items may contain owner-entered personal text; warn before issue. Machine receipt `(credential_id,operation_id)` derives a namespaced internal mutation UUID. Authorize before replay, compare canonical digest, commit receipt/shared mutation/attribution audit atomically. Direct browser receipt reuse was rejected because keys could collide. Generic state output was rejected because it exposes private extensions.

## Bounded history and analytics

Decision: SQL keyset pagination `(occurred_at DESC,id DESC)`, bounded literal search, cursor bound to car/filter; cursor never grants authorization. Analytics uses complete authorized history, preserving pre-period odometer/full-tank boundaries, then existing calculations and output projection. Explicit error above 20000 events rather than silently incomplete totals.

## Protocol

Decision: explicitly support modern 2026-07-28 per-request `params._meta` version/capabilities with mandatory discovery and complete resultType; unsupported version -32022 with supported/requested. Legacy 2025-11-25 uses initialize/initialized. No unsupported subscriptions/tasks/server requests. [Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning), [modern schema](https://modelcontextprotocol.io/specification/2026-07-28/schema), [legacy lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).

Decision: newline UTF-8 JSON-RPC STDIO, async reader/bounded tasks, cancellation suppresses late response and EOF cancels work. Only protocol on stdout. Four read-only tools, no caller URL/path/SQL. Credentials in private environment; verified remote TLS, redirects/proxies disabled, explicit literal-loopback HTTP exception, bounded deadlines/results. [STDIO](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio), [tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation).

Remote HTTP MCP was rejected for this slice: its OAuth contract adds unnecessary infrastructure. REST bearer API is not advertised as remote OAuth MCP. No runtime external provider calls in development.

## Durability

Decision: additive 006, preserving 004 notification/005 bank archive validation. Restore revokes every key before activation; backups hold verifier/metadata only. Password change/reset/disable revoke keys transactionally with sessions; re-enable never resurrects revoked keys. No destructive downgrade.
