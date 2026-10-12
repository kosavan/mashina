# Implementation Plan: Body damage map
**Branch**: `codex/body-damage-map` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Summary
Add owner-managed condition records with generic inline SVG diagrams and a list
inside the vehicle profile. Reuse mutation receipts, authorization, attachments,
IndexedDB and version conflict handling. No financial records are synthesized.

## Technical Context
- Language: Python 3.14 / TypeScript / React 19.
- Dependencies: existing FastAPI, SQLAlchemy/Alembic, Vite, Radix sheets and Lucide only.
- Storage: additive SQLite WAL revision 007; existing local image store.
- Testing: Pytest, Vitest, headless Playwright, real production-container restore.
- Target: self-hosted Linux and installable mobile/desktop browser UI from 360 px.
- Performance: retain 180 KiB entry gzip budget; lazy-load body screen, lazy images,
  six issue cards per list page. No polling, external assets or canvas libraries.
- Scope: five generic diagrams, record CRUD/history/evidence/repair link and safe upgrades.

## Constitution Check
Pre-design and post-design: all twelve principles pass. Exact money and contextual
mileage never mutate existing financial/odometer data. Auth/roles and private evidence
remain server enforced. Stable IDs and offline projection use the current durable
queue. Additive migration plus full recovery snapshot; frozen definitions unchanged.
Premium SVG, mobile/list/keyboard controls, RU/EN, demo and proper state feedback are
required. Native-device validation remains disclosed. No infrastructure changes.

## Project Structure
- `backend/body_damage.py`: normalization, transactional link checks, archive validation.
- `backend/migrations/versions/007_body_damage.py`: additive indexed table.
- `backend/storage.py`, `access.py`, `app.py`, `backup.py`, `demo.py`: integrate existing paths.
- `frontend/src/bodyGeometry.ts`, `BodyDamage.tsx`, `BodyDiagram.tsx`, `body-damage.css`:
  typed shared definitions, mobile map/list/detail/editor, generic SVG panel geometry.
- `frontend/src/types.ts`, `Views.tsx`, `offline.ts`, `permissions.ts`, locales:
  lazy vehicle section, old-cache compatibility, translations and queue integration.
- `backend/tests/test_body_damage.py`, `test_upgrades.py`; frontend unit/browser tests.
- `docs/body-damage.md`, `.ru.md`, updating/roadmaps/README/RELEASES and version files.

## Phases
Foundation and actual migration/normalization tests, then US1 marker CRUD/offline,
US2 status/evidence/repair, US3 restore/permissions/upgrades, polish and full CI release.

## Complexity Tracking
No exceptions. Unknown relationships after intentional evidence deletion are shown as
unavailable and can be cleared; dangling foreign-car evidence is never accepted.
