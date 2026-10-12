# Tasks

- [x] T001 Specify OCR scope and update local-only roadmap.
- [x] T002 Build bounded local OCR worker, pure parser and protected recognition API.
- [x] T003 Add bilingual mobile review/apply/cancel flow to existing record forms.
- [x] T004 Verify real OCR fixtures, authorization/failures, review, unchanged drafts and single Save.
- [x] T005 Document setup/limits, run regression/convergence/source scan and prepare CI-gated publication.

## Phase 2: Convergence

- [x] T006 Correct and verify bilingual numeric OCR against actual generated Russian/English image and PDF fixtures per FR-007 and Success Criteria (partial, HIGH). Linux native recognition currently misreads a digit/date; do not substitute fixture results or silently correct numbers.

Verification: Linux native OCR and all 202 backend tests passed on source 62a7634.
T006 retains the original convergence observation: clear image/printed-PDF values are
asserted exactly; a compressed scan's missing date remains unknown, never guessed.
The final release commit must pass frontend/browser/Docker and actual container OCR
checks before merge/tag. Publication is an external gate, not a claim made by a checkbox.
