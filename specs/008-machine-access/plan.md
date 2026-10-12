# Implementation Plan: Scoped API and optional MCP

**Branch**: `codex/mashina-machine-access` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Summary

Add explicitly enabled original-owner credentials, a separate versioned REST contract and a client-launched read-only STDIO adapter. Browser authentication, private banking, documents and administration stay outside the bearer namespace. Reuse existing financial and mutation logic.

## Technical Context

Python 3.14/FastAPI/Pydantic 2/SQLAlchemy 2 Core/Alembic; existing React 19/TypeScript/Vite and local design system. SQLite WAL/FULL, additive revision 006. No new server process or worker. Pytest/Vitest/headless mobile Playwright plus real protocol subprocess tests with fake local HTTP upstream. Linux amd64 Docker on a low-power server; Windows development supported.

History: first 25 of 10000 events under one second, maximum 100 per page, search 200 characters. Analytics receives complete history up to 20000 events; above cap gives explicit size error, never truncated totals. Existing entry budget 180 KiB gzip remains enforced.

Credentials: SHA-256 verifier of 32 random bytes, default 90-day expiry, maximum 365 days, ten active keys per user and 50 explicitly selected cars per key. Read default, write opt-in; no wildcard. Adapter: 1 MiB frame/upstream/output bounds, four in-flight requests, ten-second HTTP deadline, no redirects/environment proxies, verified TLS; HTTP only literal loopback hosts. No heavy SDK.

## Constitution Check

Pre-research and post-design pass: I shared exact calculations/idempotency; II custom mobile copy-once states; III modular monolith plus ephemeral client adapter; IV no cloud; V explicit DTOs/verifier-only storage; VI 360 px/themes/accessibility; VII online-only credential controls clearly marked; VIII authorization/restore/transport/performance/mobile tests; IX typed contracts/additive migration; X bounded reads/no polling; XI restore revokes credentials; XII verified MVP/1.1 precede optional 2.0. No complexity exception.

## Project Structure

`backend/machine_access.py` credential lifecycle/transactional authorization; `backend/machine_api.py` browser management and scoped routes; `backend/machine_models.py` strict DTOs; `backend/machine_protocol.py` standalone adapter; `backend/machine_archive.py` restore validation; `backend/migrations/versions/006_machine_access.py`. Extend `accounts.py`, `backup.py`, `app.py`. Tests: `backend/tests/test_machine_access.py`, `test_machine_protocol.py`, performance suite; lazy `frontend/src/MachineAccess.tsx`, `frontend/tests/machine-access.spec.ts`. Owner instructions: `docs/machine-access.md`.

## Delivery

1. Strict contracts/migration/lifecycle tests and fresh transaction-scoped authorization.
2. Bounded reads and scoped idempotent writes with replay filtering.
3. Tested modern 2026-07-28/legacy 2025-11-25 protocol paths, secure transport and cancellation/EOF.
4. Finished settings, restore/password invalidation and full regression/source scan/screenshots/Docker CI.
5. Converge every acceptance criterion, recording actual evidence and remaining work.

Read-only research agent examined ownership/receipts/restore/official schemas. Design decisions are in research.md. No extension hooks exist.
