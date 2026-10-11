# Implementation Plan: MASHINA 1.1 ownership tools
**Branch**: codex/mashina-1-1 | **Date**: 2026-10-11 | **Spec**: spec.md

## Summary
Extend the existing modular monolith and bespoke mobile UI. Keep the financial event table authoritative.

## Technical Context
Existing React/TypeScript/Tailwind/Query and FastAPI/SQLAlchemy/Alembic/SQLite stack, no new runtime dependencies.
Add `tire_sets`, `budgets`, `recurring_costs` versioned, owner-scoped envelope tables through additive Alembic revision 002.
Add entity validators in backend/ownership.py; reuse mutation receipts, audit and optimistic versions.
Add `OwnershipTools.tsx` lazy view under Maintenance and existing custom Sheet forms. No dashboard scaffold.
Extend offline state projection and typed entity lists. CSV preview/commit is online-only and explicit.
API import commit validates again; canonical row-derived operation IDs ensure exactly-once retries. Changed external-ID payload conflicts rather than overwrites.
Old backup revision 001 is upgraded inside the verified restore recovery boundary; 002 archives also supported.

## Constitution Check
PASS: exact minor-unit money, no automatic forecast expenses, no telemetry/cloud, additive migrations,
owner-scoped access, independent behavioral tests, mobile original design and optional advanced panels.

## Project Structure
backend/ownership.py — pure tire/budget/payment validation and projections, CSV normalization.
backend/migrations/versions/002_ownership.py — additive tables only.
backend/storage.py, backend/backup.py, backend/app.py — extend existing boundaries.
frontend/src/OwnershipTools.tsx — tabs/cards/forms/CSV review.
frontend/src/types.ts, offline.ts — cached entities and ordered mutations.
backend/tests/test_ownership.py, frontend/tests/app.spec.ts — acceptance tests.

## Complexity Tracking
No new services, packages, recurring workers or materialized financial copies. CSV parse <=1000 rows /2MB.
Forecast expands at most 12 months per recurring record. Use existing 180KB entry bundle budget with lazy module.
