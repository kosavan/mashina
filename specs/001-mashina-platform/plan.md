# Implementation Plan: MASHINA
**Branch**: existing master | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

## Summary
Deliver the five MVP user stories as a single self-hosted application. FastAPI serves
an authenticated API and the built React/TypeScript Vite frontend on one origin.
SQLite is authoritative; local uploads live alongside the database in a mounted data
volume. IndexedDB stores a user-scoped snapshot and transactional offline outbox.

## Technical Context
**Language/Version**: Python 3.12+; TypeScript 5 / React 19; Node 20.18+ for build only.
**Primary Dependencies**: FastAPI, uvicorn, argon2-cffi, python-multipart, Pillow;
Vite 6, Tailwind/shadcn/ui, TanStack Query, Recharts, bundled Manrope; pytest/httpx, Vitest and Playwright for verification.
**Storage**: SQLAlchemy 2 / Alembic / sqlite3, WAL (patched SQLite 3.51.3+), foreign keys, busy timeout, FULL sync;
integer minor-unit money and Decimal arithmetic, local uploads, IndexedDB.
**Testing**: pytest domain/API/security/backup integration; Playwright browser journeys.
**Target Platform**: Linux container, modern Safari/iPhone, Chromium/Firefox desktop.
**Project Type**: web application, single service and build-time frontend tooling.
**Performance Goals**: 10-20 second quick entry target; 1 CPU/512 MB personal server.
**Constraints**: no external runtime assets/services; offline foreground sync; one owner
in MVP; 20 MB attachment and 200 MB restore limits; one server worker.
**Scale/Scope**: personal garage, thousands of events, nine navigation destinations.

## Constitution Check
Pre-research PASS: separation of domain/storage/API/UI, exact money, focused tests,
local data and backups, reproducible locked installs, versioned migrations.
Post-design PASS: explicit conflict handling and idempotency, user-scoped protected
files, restore validation and rollback, acceptance tests. No justified exceptions.

## Project Structure
```text
backend/app.py          # HTTP, auth, scoped routes
backend/domain.py       # validation, money, fuel, analytics, reminders
backend/storage.py      # migrations, transactions, mutations, audit
backend/backup.py       # verified archive export/restore
backend/migrations/versions/001_initial.py
backend/tests/          # domain and end-to-end API checks
frontend/src/           # app, forms, views, offline, theme
frontend/public/        # service worker, manifest, local visual assets
frontend/tests/         # browser journeys
Dockerfile
docker-compose.yml
Caddyfile.example
README.md
```
**Structure Decision**: Small modules by responsibility; typed event payloads represent
Expense/FuelEntry/MaintenanceRecord/OdometerReading/TimelineEvent without duplicate
financial tables. Monetary amounts are normalized server-side in one event row.

## Complexity Tracking
No constitution violations. No microservices, background workers or external cache required. SQLAlchemy Core defines storage contracts and Alembic manages schema revisions.



## Authoritative stack amendment — 2026-10-11
React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui accessible primitives with a
custom product layout; TanStack Query 5, lazy Recharts. FastAPI Pydantic REST /api/v1,
SQLAlchemy 2 Core, Alembic startup migrations, SQLite WAL and serialized writes.
All frontend source uses .tsx/.ts. Vitest + Playwright + pytest.
Patched SQLite >=3.51.3 required in production. Local development uses one serialized
connection, avoiding multiple concurrent WAL connections on an older SQLite runtime.
Additive migrations; backup/recovery required before destructive evolution.
Backups include files, configurable retention CLI, same-disk warning in settings.
Budgets: main JS gzip <=180 KB; analytics lazy; 10000-event analytics <1 second on
test workstation; no idle polling/workers; <=50 timeline rows rendered per page.
Demo: separate temporary database per session, synthetic fixtures, real data inaccessible;
interactive mutations, reset and expiry, opportunistic cleanup. No real exports/restores.
