# Implementation Plan: vehicle sharing
**Branch** codex/mashina-sharing | **Date** 2026-10-11

## Summary
Keep actor identity, vehicle owner and immutable record author distinct. Centralize authorization inside the same SQLAlchemy transaction as writes. No new runtime packages or services.

## Technical Context
Add Alembic 003: users.is_admin/disabled, vehicle_access with unique vehicle/user and role constraint, events.created_by and attachments.created_by/visibility columns. Existing owner_id stays the resource owner, receipts/audit owner_id denotes actor (document explicitly). Delegated owner access does not transfer vehicles.owner_id. Initial owner always retains access.
Separate helpers: require_vehicle_access, require_event_write, require_attachment_read/write; strict owned remains for actor categories/settings. On receipt replay revalidate current access before returning prior payload. Query scopes must not multiply financial rows through joins.
Driver: read assigned cars/events/tires/reminders, write own events, own-event attachments; no profile, access, budget/recurring/schedule edits or bulk import. Budgets and recurring costs are owner-only. Personal category/settings and own-car creation remain per-user operations.
Documents owner-only by default, explicit shared by owner; own upload visible to uploader. Cover images are explicitly shared with vehicle members when assigned. Metadata filtering occurs before state serialization. Recheck upload rights after await file read, in final insert transaction.
Full archive/restore/account management requires active administrator. JSON/CSV remain scoped. Password change requires old password, invalidates sessions, issues a new session. Disable/reset invalidates sessions.
UI consumes server capability flags for vehicles/events/files, hides forbidden controls and labels shared roles. Actor cache keys remain scoped; successful scope changes purge cached reports and stop projecting forbidden outbox operations while preserving them as blocked drafts. No claim of remote wipe on disconnected devices.
Backward restore permits 001/002/003, upgrades before live replacement, validates active admin/grants/authors/file linkage and invalidates sessions. Tests must check old migration and multicount archive.

## Constitution Check
PASS conditional on authorization matrix, spoofing/replay/revocation/file tests and browser account-switch/offline acceptance. No administrator bypass for car data; global archive access is explicit server ownership privilege.

## Project Structure
backend/access.py — central policy and account/access helper routes.
backend/migrations/versions/003_sharing.py — additive schema and backfill.
backend/storage.py, app.py, backup.py, cli.py — explicit actor and scoped boundaries.
frontend/src/Sharing.tsx — tailored account/access/password sheets.
frontend/src/types.ts, App.tsx, Forms.tsx, Views.tsx, OwnershipTools.tsx, offline.ts — capabilities and privacy.
backend/tests/test_access.py + browser journeys — independent role matrix.

## Complexity Tracking
No invites/email workers, OAuth or separate identity server. Accounts are local and admin-created. Owner delegation is grant management, not ownership transfer. Keep monolith and existing bundle budgets via lazy Sharing UI.
