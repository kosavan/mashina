# Feature Specification: Reviewed document recognition

**Feature Branch**: `codex/mashina-document-review`
**Created**: 2026-10-12
**Status**: Ready for planning
**Input**: MASHINA 2.0 optional receipt and service-document recognition with mandatory human review.

## User Scenarios & Testing

### User Story 1 — Deliberately process a private source (Priority: P1)
The owner selects a photograph or PDF, sees the destination and selected pages, and explicitly starts optional recognition.
**Independent Test**: Recognize an invented receipt with an isolated processor; verify no financial or mileage record was created.
**Acceptance Scenarios**:
1. Given disabled recognition, when documents open, ordinary uploads/previews work and configuration requirements are explained.
2. Given a configured processor, when consent is absent, no content is sent.
3. Given an image or scanned PDF, when selected pages are approved, only those pages are sent and the result is an unverified draft excluded from reports.
4. Given timeout or malformed output, when processing fails, source remains intact, no operation appears and retry requires explicit action with an uncertain-remote-outcome explanation.

### User Story 2 — Review and record once (Priority: P1)
The user compares the source with editable suggestions, chooses expense, fuel or maintenance and confirms corrected fields.
**Independent Test**: Correct a service order, confirm twice and verify one event, one exact expense total and linked source.
**Acceptance Scenarios**:
1. Given incomplete or conflicting output, review leaves missing values blank, shows warnings and requires valid human-reviewed fields.
2. Given corrected expense/fuel/maintenance fields, confirmation applies shared exact calculations and historical odometer warnings, links the source and updates reports once.
3. Given an already recorded source or identical uploaded content, retry shows the existing record or a duplicate warning without silently creating another expense.
4. Given edited draft and interrupted connectivity/reload, durable actor-isolated edits remain recoverable and pending confirmation is distinguished from recorded history.
5. Given another user or revoked access, draft read/edit/confirmation is denied even on retry.

### User Story 3 — Polished and safe optional capability (Priority: P1)
Recognition fits the mobile document experience and remains safe under hostile output and restore.
**Independent Test**: Complete review at 360 px in both themes, restore a backup and verify source, draft and history.
**Acceptance Scenarios**:
1. Given a small phone in either theme, controls are accessible, the source can be inspected and horizontal scrolling is absent.
2. Given output instructions, unknown fields, links or false totals, output cannot execute actions, change permissions, create records or bypass validation.
3. Given a restored backup, files, drafts and confirmed history survive without automatic processing resubmission.
4. Given demo mode, no real processor is contacted and any fictional example is explicitly labeled.

## Requirements
### Functional Requirements
- **FR-001**: Optional, disabled-by-default, owner-configured recognition; core features require no cloud or paid service.
- **FR-002**: Informed consent for every attempt names destination and source/pages; no unrelated history, accounts, secrets or documents are transmitted.
- **FR-003**: Images and scanned/text PDFs support bounded page selection and partial-document warnings; malformed, encrypted, oversized and unsupported sources fail safely.
- **FR-004**: Output is an editable, unverified draft with provenance and honest uncertainty; absent values stay missing, without automatic history/mileage changes.
- **FR-005**: Explicit confirmation uses shared exact money/fuel/odometer rules and atomically creates one event with source linkage. Retries are idempotent and identical source content is flagged before separate recording.
- **FR-006**: Drafts are actor-isolated and subject to current document/vehicle permissions, durably persist, survive reload/offline interruptions and preserve conflicts for correction.
- **FR-007**: Inputs and untrusted output are bounded/validated; credentials remain server-side; output instructions/links/unknown fields grant no capabilities.
- **FR-008**: Finished mobile UI includes loading, empty, consent, review, saved/pending, conflict and error states in both themes. Demo never contacts a real processor.
- **FR-009**: Backup/export/restore preserves source files, drafts, provenance and confirmation receipts without resubmission or duplicate expenses.
### Key Entities
Recognition draft: actor, vehicle, source/fingerprint, selected pages, processor identity, editable proposals, warnings, revision/status.
Recognition attempt: stable identity, consent context, processing/error state; no automatic retry after uncertain outcome.
Confirmed source: stable source-to-history association and confirmation receipt.

## Edge Cases
Rotated/large images; scanned/encrypted/malformed/many-page PDFs; selection omits totals; multiple currencies; missing or inconsistent totals; invalid dates/odometer; malicious document instructions; invalid processor structure; timeout after remote acceptance; concurrent confirmation; repeated uploads; deleted source/event; revoked access during processing; restore during attempt; full local storage; expired session; offline pending confirmation.

## Assumptions and Scope
Optional 2.0 slice after verified MVP and 1.1. Recognition assists entry, not document certification. Owner supplies compatible local or explicitly chosen remote processing infrastructure; MASHINA does not provision models. Processing needs server connectivity; draft editing persists offline with explicit synchronization. No history AI search, bot, OBD, automatic accounting interpretation or background batch processing here.

## Success Criteria
- **SC-001**: Automated image/scanned-PDF journeys produce reviewable drafts and zero history/financial changes before confirmation.
- **SC-002**: Expense/fuel/maintenance match shared calculations; repeated/concurrent confirmations and duplicate-content tests produce no unintended duplicate expense.
- **SC-003**: Authorization, hostile output, failure and offline/reload tests preserve private data and durable edits without hidden requests.
- **SC-004**: Automated 360 px journeys pass in both themes with accessible controls, source comparison and no overflow; ordinary quick entry remains unaffected.
- **SC-005**: Backup/restore/migration tests preserve files, drafts, provenance and history without automatic recognition.
- **SC-006**: Attempts are limited to five selected pages and one active attempt per user; disabled installations start no recognition worker/recurring job. Existing delivery/responsiveness budgets remain enforced.
