# Tasks

- [x] T001 Specify OCR scope and update local-only roadmap.
- [x] T002 Build bounded local OCR worker, pure parser and protected recognition API.
- [x] T003 Add bilingual mobile review/apply/cancel flow to existing record forms.
- [ ] T004 Verify real OCR fixtures, authorization/failures, review, unchanged drafts and single Save.
- [ ] T005 Document setup/limits, run regression/convergence/source scan and publish after CI.

## Phase 2: Convergence

- [ ] T006 Correct and verify bilingual numeric OCR against actual generated Russian/English image and PDF fixtures per FR-007 and Success Criteria (partial, HIGH). Linux native recognition currently misreads a digit/date; do not substitute fixture results or silently correct numbers.
