# Feature Specification: MASHINA optional machine access

**Feature**: 008-machine-access | **Created**: 2026-10-12 | **Status**: Draft

User request: release 2.0 includes an open API and possible MCP integration. These remain optional, configured by the owner, with no cloud dependence, hidden sharing or extra always-on infrastructure. This slice follows verified bank review and does not include AI recognition, Telegram expense entry or OBD components.

## User Scenarios & Testing

### US1 — Deliberately grant and revoke access (P1)
An original vehicle owner can allow a chosen client to access explicitly selected vehicles and remove that access immediately.

Independent test: create a read-only credential for one of two cars; only that car is accessible, then revoke and verify every subsequent request is denied.

1. Machine access is disabled by default. Settings explain how the server owner enables it without changing ordinary garage behavior. Demo cannot issue credentials usable against the real garage; any demo demonstration is visibly isolated.
2. An authenticated original owner chooses at least one of their cars, a label (1–80 characters), expiry (1–365 days; default 90), and permissions. Reading is the default; changing history requires a separate deliberate opt-in. Delegated owners, drivers and admins without original ownership cannot issue access to another person's car. New future cars are never automatically granted.
3. The secret is shown once after explicit confirmation, with safe copy/manual-copy feedback and an explanation of exactly which history may leave the server. It is never stored in browser persistent storage, URLs, ordinary exports, audit content or server plaintext credential records. List screens show masked identity, cars, permissions, expiry and revocation state only.
4. The owner can revoke a credential online. Disabled users, expired/revoked credentials, lost original ownership and changed passwords block later machine access. No offline issue/revoke success is claimed. Server feature disable blocks all existing credentials without altering history.

### US2 — Useful, bounded API access (P1)
A chosen client can read granted history and, only with write permission, maintain ordinary events/reminders using the same rules as the application.

Independent test: scoped reads return one car; allowed exact expense writes retry once, stale versions conflict, a second car and administrative endpoints remain inaccessible.

1. A documented versioned contract covers vehicle summaries, paginated event history/search, reminders and financial analytics. Results use established currency/period/odometer definitions and clear missing-data values. VIN, number plates, files, private bank provenance, accounts, credentials, notification channels, full backups and administrative actions are excluded.
2. Page size defaults to 25 and cannot exceed 100; search is bounded to 200 characters. Large histories remain paginated. The same selected-car authorization is enforced on every request, including guessed identifiers and receipt replays. No credential acts as a browser session or administrator login.
3. Optional write permission allows ordinary event/reminder creation and correction/deletion/completion with explicit stable operation IDs and version checks. Existing financial/odometer/reminder validation is reused. Retries and concurrent requests do not duplicate expenses; unknown fields, foreign cars and unauthorized actions fail without partial writes. No machine write may silently correct a historical odometer or invent confirmation.
4. Requests have bounded inputs/results, meaningful errors and documented limits. The API cannot turn on external providers or write vehicle profiles, permissions, bank ledgers, documents, settings or credentials. Logs/audits identify the client operation without exposing secrets.

### US3 — Read-only MCP connection (P1)
An owner can configure a compatible local MCP client to inspect granted cars, search history and request analytics.

Independent test: a real client-launched adapter exchanges discover/list/call messages, reads only granted data, rejects mutation/unknown tools and stops on input closure.

1. The optional component is launched by the chosen client and needs no new always-on server process. Setup clearly names supported protocol versions and configuration. No paid model, cloud registration or remote MCP authorization service is required.
2. Tools expose only vehicle summaries, paginated history/search, reminders and exact analytics through the same scoped API. No write tools, arbitrary query/path/URL tool, file access or private bank/account/document data. Results remain untrusted user data, not instructions to execute.
3. Client credentials are configured privately, never command arguments, query strings or protocol output. The adapter contacts only the owner's fixed configured server, validates secure transport, does not follow redirects with credentials, bounds time/results and emits valid protocol messages only. Remote connections require HTTPS; explicitly documented loopback development use is permitted.
4. Discovery, unsupported versions, invalid messages, unavailable server, revoked credentials and oversized results have tested actionable behavior. No unsupported client compatibility, background sync or model behavior is promised.

### US4 — Durable and polished administration (P1)
Owners understand their machine grants and can safely restore the garage without reactivating old clients.

Independent test: backup/restore preserves vehicle history and credential audit identity while making all old credentials unusable; the 360 px settings flow explains and verifies access/revocation.

1. Additive migration and legacy restore preserve all existing ownership, banking and notification invariants. A full backup contains credential metadata/hashes but not stored plaintext secrets. Restore revokes machine credentials, expires transient data and retains existing session/notification safety behavior.
2. Custom Russian mobile settings, dark/light themes, accessible labels, touch targets and safe-area handling. Defined loading, empty, error, copy-once, confirmation and revoked/expired states. Scope disclosure is prominent before issue; losing an unsaved creation form or one-time secret requires a clear warning.
3. Source-only publication, automated security/domain/migration/protocol/mobile tests, documented development and owner setup. No real third-party client receives user data during development. Existing app journeys and performance budgets continue passing.

## Functional Requirements

- FR-001 Optional server-controlled machine access, default off, scoped original-owner grants with expiry/read default/write opt-in and safe secret lifecycle.
- FR-002 Fresh per-request car/scope/user/credential authorization; revocation, password change and server disable take effect without a session-equivalent bypass.
- FR-003 Useful versioned read API with bounded pagination/search and consistent existing analytics, excluding sensitive unrelated domains.
- FR-004 Explicit idempotent/versioned event/reminder writes only under write grant, with shared exact validation and no hidden odometer confirmation.
- FR-005 Optional compatible read-only MCP component with fixed owner server, secure credential handling, bounded transport and accurate protocol behavior.
- FR-006 Additive migration and tested restore that revokes credentials while preserving all existing history/security invariants.
- FR-007 Finished Russian mobile grant/revoke/copy-once flow and complete setup/contract/security documentation.

## Success Criteria

- SC-001 A credential scoped to one of two vehicles cannot read/write the second, private banking/documents or administrative data; tested default-off, missing/expired/revoked/disabled/lost-owner/password-change states.
- SC-002 Exact created expense increases analytics once after duplicate/concurrent/lost-response retries; stale/foreign/unknown-field mutations fail with unchanged history. Reminder completion requires fresh confirmation where the application does.
- SC-003 History pages contain at most 100 records and bounded search; first 25 results from 10000 events return under one second on the documented fixture. Existing analytics and frontend entry budgets remain satisfied.
- SC-004 Framed protocol subprocess tests cover advertised versions, discovery, list/call/error, non-mutating tools, token redaction, fixed server/redirect/TLS/body/time bounds and prompt EOF exit.
- SC-005 Backup/restore and legacy migrations retain vehicle/attachment/bank/notification integrity and invalidate all old machine credentials. No secret appears in ordinary state/export/audit/list/browser storage.
- SC-006 Headless 360 px dark/light issue/copy/revoke/offline/error journeys, full automated regression and Linux container CI pass. No visible workstation windows or external user-data transmission.

## Key Entities

MachineCredential: private owner-issued identity, secret verifier, label, expiry, permission set and revoked state.
VehicleGrant: explicit relationship between one credential and an originally owned vehicle; no wildcard future grant.
MachineOperation: traceable client identity and stable operation/version information, without secret content.
ProtocolTool: a documented read-only operation over the same authorized data.

## Edge Cases

Revocation during a request must have a defined transaction boundary; future requests are denied. A restored or expired secret never silently reactivates. Duplicate operation IDs with changed payload conflict. Partial grants never widen a list/search/analytics query. A guessed ID, foreign event or authorization error must not disclose excluded data. A dropped response preserves retry identity. Credentials cannot be recovered from a masked list. Browser copy failure provides manual selection without false success. MCP cancellation/EOF and invalid framing cannot leak credentials or keep an unnecessary process alive. Oversized histories return pagination/errors, not truncated financial totals presented as complete.

## Assumptions and Scope

Original ownership is required to issue/use machine grants; delegated collaboration roles do not imply integration authority. The owner deliberately chooses the recipient client and is informed that allowed ordinary descriptions/financial history may be sent to it. MCP is a local client-launched read-only integration, not a remotely hosted OAuth service. Supported versions and client requirements are documented/tested; universal client support is not claimed. No new external connection is enabled automatically. Later AI/Telegram/OBD slices may request further narrowly scoped contracts with separate specifications.
