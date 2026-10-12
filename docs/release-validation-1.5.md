# MASHINA 1.5 — validation

## Scope and acceptance evidence

Local on-demand text OCR in fuel, expense, service and odometer forms. Receipts,
workshop documents, dashboard photos and arbitrary app screenshots use the owner's
server only. One selected PDF page; no automatic records, external model endpoints
or persistent OCR history. No schema or infrastructure changes.

- FR-001: native Tesseract/Poppler worker and generated English/Russian image/PDF fixtures.
- FR-002/005: inline bilingual review, editable values and unchecked field selection;
  selected fields only, cancel preserves draft, original attachment opt-in.
- FR-003/006: recognition API has no financial/mileage writes; normal exact/idempotent
  Save remains authoritative. Full tank and unknown values are never inferred.
- FR-004: session/CSRF, vehicle permissions before/after processing, revoked-driver test,
  private temporary files, bounded input/output/time/concurrency and Linux resource caps.
- FR-007: RU/EN resources, accessible labels, 360px review/cancel/single-save browser tests.
- FR-008: local-only roadmap and documented multipage/line-item/dashboard follow-ups.

## Local evidence (Windows, 12 October 2026)

196 Pytest cases pass; 6 actual native-engine cases are explicitly skipped because
this workstation has no Tesseract/Poppler installation. Skips become failures in CI.
Ruff, TypeScript, ESLint, Prettier and all 24 Vitest cases pass. All 32 Playwright
journeys pass, including reviewed OCR field application, comma-decimal editing,
unchanged unselected odometer/description, cancel, offline/manual fallback and exactly
one saved fuel expense with no unrequested attachment. Browser-controlled extraction
responses test interaction only, never production/demo recognition.

Production app entry: 173.7 KiB gzip, under the existing 180 KiB budget. The 360px
review screenshot was inspected; long content scrolls inside the existing sheet.
Source/runtime scan passes. Tests and screenshots use synthetic data.

## Required Linux and release gates

All 202 backend tests, including six real-engine cases, passed in Linux on source
`62a7634`. Generated English/Russian PNG and printed PDF assert exact fields; a
compressed scan separately verifies honest uncertainty. The same source must pass full regression and production Docker build,
health and actual image/PDF recognition under the non-root container user.
No release is published until exact-head GitHub CI is green; the release links that run.
The initial native fixture failures remain recorded in GitHub, not hidden by retries
or invented recognition values. Clear PNG and native printed PDF have exact numeric/date
assertions. Compressed raster PDF separately checks that a missing date stays unknown
instead of guessing lost punctuation. Final verification is reported in the release.

## Limits

OCR suggestions can be wrong even when labels and digits look plausible. Human
selection/correction remains mandatory. Structured workshop tables, multiple PDF pages,
seven-segment specialization and crop/rotation are follow-ups. Recognition needs the
server connection; ordinary offline manual entry remains available. Process isolation
and resource caps are not a complete security sandbox. No physical iPhone, macOS/arm64
Docker or old home-server hardware benchmark was performed in this environment.

## Spec Kit convergence

The initial convergence found one HIGH partial gap in FR-007/native fixture verification,
recorded as T006. Implementation adds measured resolution/contrast normalization and
separates printed-PDF accuracy from compressed-scan uncertainty. A follow-up assessed
all 8 functional requirements, 3 user stories, 8 success checks, 8 scoped plan decisions,
6 implementation tasks and 12 constitutional principles. No remaining buildable gap was
found. Convergence leaves tasks.md unchanged; release publication remains gated by
successful exact-head CI. Source/runtime scan covers the final staged source files.
