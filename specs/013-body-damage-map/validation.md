# Body damage validation

Validation date: 2026-10-12. All fixtures and screenshots are synthetic, isolated test/demo data.

## Traceability

| Requirement | Implementation / evidence |
|---|---|
| FR-001, SC-001, US1/AC1 | BodyDiagram/bodyGeometry; five keyboard views, two distinct points on one panel, mobile browser scenario |
| FR-002 | normalize_damage and typed editor; invalid date/coordinate/type/mileage/estimate tests |
| FR-003, US1/AC2 | Existing versioned mutation engine; stale409, delete/undo, unsaved-close browser test |
| FR-004, US2/AC1 | Server-owned status_history; repaired/reopened backend history, before/after browser images |
| FR-005, US2/AC3 | Authorized attachment reuse/upload/unlink; deleted-photo edit and private-driver403 tests |
| FR-006, SC-003, US2/AC2 | Same-car maintenance validation; exact expense and odometer invariants in backend/browser tests |
| FR-007, SC-002, US1/AC3 | Missing body_damages in representative old IndexedDB cache; offline create/edit/reload and exactly-one server record |
| FR-008, SC-005, US3/AC2 | Owners write, drivers read; unauthorized account and private-file checks |
| FR-009, SC-004, US3/AC1 | Actual schema001-007 upgrade matrix; full restore/restart, image bytes and corrupt archive rejection |
| FR-010, SC-005 | RU/EN resources, keyboard panels, list alternative, 360px overflow, dark/light/reduced motion |
| FR-011 | Six-card list pagination, filters, pending/empty/error states, lazy module/images, no new dependency |
| FR-012, US3/AC3 | Isolated demo seed, archived-car restore, full existing regression and CI container drill |

## Executed local checks

- Full Pytest regression: 235 passed, 6 native OCR checks skipped on Windows;
  subsequent body-damage run adds malformed-record coverage: 25 passed.
- Vitest: 27 passed. TypeScript, ESLint, Prettier and Ruff passed.
- Headless Chromium: all 38 scenarios passed; the expanded three body scenarios also passed separately.
- Production build: initial JavaScript 176.9 KiB gzip within 180 KiB budget;
  body module about 9.9 KiB gzip, loaded separately. No new package dependencies.
- Documentation language/link check and frozen migration check passed. Revision001-006
  and initial schema retain their original fingerprints; new007 is frozen.
- Visually inspected side/front/rear/top renderings, both themes, English mobile and
  Russian desktop screenshots. Modern curved vector bodies replaced the initial angular drawing.

## Convergence

Spec Kit implement/converge reviewed 12FR, 5SC, 9 acceptance scenarios, the plan and
all twelve constitutional principles. First pass added T019 for the old-cache gap;
user design feedback added T020. Both are implemented and tested. Second pass found
no remaining buildable gaps and left tasks.md unchanged (SHA256
D8E25E60D437064ECC8D04FE425011DC21FDAAF1FD6434DA1532FD7FBA9BA012).

## Release gates and limits

Publication requires successful exact-source GitHub CI before merge and again on main,
including Linux real OCR and read-only non-root container full restore/restart.
The container drill explicitly preserves new damage IDs, image bytes, photo references
and status history. GitHub Actions and the published release are the authoritative
execution records for these environment-dependent gates.

Physical iPhone and arm64 validation remain open. Diagrams are generic, severity is
owner-assessed, and new photo binaries are online-only until uploaded; the durable
queue stores marker/text mutations, not selected Files. Archive restore retains the
existing 200 MiB compressed/expanded limit. No infrastructure changes were made.
