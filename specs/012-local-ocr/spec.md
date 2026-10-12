# Feature Specification: fully local reviewed OCR

Created: 2026-10-12. Status: specified. Owner requests continued development without
waiting for manual testing; OCR receipts, workshop invoices, dashboard photos and general
screenshots must all remain local.

## User Scenarios & Testing

### US1 — Receipt or workshop document (P1)
While adding fuel, expense or service, choose an image or PDF page, recognize locally,
inspect text and suggested fields, edit them and explicitly apply to the current draft.
No history or attachments are created until the normal Save flow. Full tank is never inferred.

### US2 — Odometer or arbitrary app screen (P1)
Choose dashboard mode while entering fuel/mileage, or screenshot mode for any app screen.
Read extracted text, deliberately confirm the kilometres value and apply selected fields.
Numbers without meaningful labels are not silently assigned. Miles are never converted implicitly.

### US3 — Private, bounded failures (P1)
Other users cannot process a car's document. Corrupt/oversized/unsupported files, absent
engine, overload and timeout return useful localized errors without losing the existing draft.
Offline mode clearly requires the local server connection for OCR, while manual entry continues.

## Functional Requirements

- FR-001 Images and one explicitly selected PDF page support on-demand local text recognition.
- FR-002 Review text and editable proposed date/amount/fuel/odometer fields before applying.
- FR-003 No record creation, inferred full-tank flag, invented missing data or cloud traffic.
- FR-004 Authorization/CSRF, bounded upload/pages/pixels/text/time/concurrency, private temp cleanup.
- FR-005 Applying suggestions preserves unselected fields; attaching original is opt-in.
- FR-006 Existing exact money, historical mileage validation, offline queue and idempotent Save remain.
- FR-007 Complete RU/EN mobile UI, real-engine generated fixture tests and browser review/cancel tests.
- FR-008 Publish roadmap with general screenshots, workshop line-item follow-up and local-only policy.

## Success Criteria

Authenticated owner can extract actual generated printed fixtures, inspect/correct/apply
fields and save one record. Cancel leaves draft/history untouched. Unknown/ambiguous values
are omitted. A second user and untrusted origin are rejected. One recognition at a time,
maximum 20 MiB input, selected page 1–20, 25 MP source image, 64 KiB result and 45 s deadline.
No persistent OCR database or background service; normal app budget remains under 180 KiB gzip.

## Entities / Assumptions

RecognitionResult is transient text + conservative suggestions, never authority-bearing
record IDs. Original source persists only after explicit attachment and normal Save.
First slice handles one PDF page; multi-page tables, crop, seven-segment specialization
and optional local vision models are follow-ups. Photos can require manual correction.
