# Feature Specification: Body damage map

**Feature Branch**: `codex/body-damage-map`
**Created**: 2026-10-12
**Status**: Ready for planning
**Input**: Implement and release the accepted vehicle body diagram roadmap feature.

## User Scenarios & Testing

### User Story 1 - Record visible damage (Priority: P1)
An owner opens a car profile, chooses a body view and marks a panel/point. A mobile
form records the issue and a list gives the same information without using the map.
**Why this priority**: Makes exterior condition useful and actionable.
**Independent Test**: On a 360 px screen create two scratches on one panel, edit one,
filter unresolved issues, delete and undo without touching expenses or the odometer.
**Acceptance Scenarios**:
1. Given a car, when two markers are saved on one panel, then both retain distinct IDs and positions after reload.
2. Given an unsaved form, when closing it, then a discard confirmation protects edits.
3. Given an old offline cache, when a marker is saved/edited offline and reloaded, then it remains pending and synchronizes exactly once.

### User Story 2 - Track repair evidence (Priority: P2)
An owner attaches before/after images, changes status and links a confirmed service record.
**Why this priority**: Preserves the journey from discovering damage to its repair.
**Independent Test**: Upload a before image, mark repaired, attach an after image and
link an existing maintenance expense; verify its cost remains counted once.
**Acceptance Scenarios**:
1. Given a damaged panel, when its status changes, then dated previous statuses remain readable.
2. Given a service event, when linked, then damage shows the repair context but creates no financial or mileage entry.
3. Given removed service or photo evidence, then the issue remains editable and explains unavailable evidence.

### User Story 3 - Preserve ownership and upgrades (Priority: P1)
An installed garage upgrades safely and can export/restore the entire damage history.
**Why this priority**: Existing history and private evidence must remain reliable.
**Independent Test**: Upgrade supported installed versions, create damage and images,
export/restore, restart and verify original cars, expenses, IDs, preferences and files.
**Acceptance Scenarios**:
1. Given an existing garage, when upgraded, then all old records survive and a recovery snapshot exists.
2. Given an unauthorized user or driver, then private files remain protected and only owners can edit damage.
3. Given a sold or archived car, then damage and repair history remain available.

### Edge Cases
- Multiple issues on one panel; empty, repaired-only and filtered lists; keyboard access.
- Invalid/outside marker coordinates, unsupported fields, future dates, cross-car links.
- Stale-version edits, revoked access, duplicate operations, missing/deleted repair evidence.
- Offline images are not promised: text/marker drafts save, photos require an online upload.
- Demo data is isolated and explicitly fictional; real user text is never translated.

## Requirements
### Functional Requirements
- **FR-001**: Provide front, rear, left, right and top views of a generic car with selectable panels and point markers; support multiple issues on one panel.
- **FR-002**: Capture title, damage type (scratch/dent/chip/corrosion/crack/other), owner-assessed severity, discovery date, optional mileage, notes, view/panel/position and status (observed/needs repair/planned/repaired/monitoring).
- **FR-003**: Support creation, editing, soft deletion and undo with conflicts surfaced and unsaved drafts protected.
- **FR-004**: Preserve a dated status history and before/after evidence through completion, reopening, archive and sale.
- **FR-005**: Attach/view authorized local images, reuse existing vehicle images, unlink without deleting files, and clearly explain offline upload limits and unavailable evidence.
- **FR-006**: Link only maintenance belonging to the same car. Estimates stay separate from actual costs; no new financial or odometer record is created by damage operations.
- **FR-007**: Persist offline marker/text actions before confirming success; reload/replay must preserve order and prevent duplicates. Older caches without damage data remain supported.
- **FR-008**: Authenticate access and enforce existing vehicle roles. Owners edit; drivers can read vehicle condition and only images already authorized for them.
- **FR-009**: Include records in CSV/JSON and full backup/restore with reference validation. Upgrade every supported schema without resetting data; freeze existing migrations.
- **FR-010**: Provide polished English/Russian, dark/light and reduced-motion-safe UI from 360 px, with meaningful keyboard/screen reader controls and a list alternative to the map.
- **FR-011**: Supply useful empty/error/pending states, status filters, lazy images and paginated issue lists; require no external services or heavy new dependencies.
- **FR-012**: Include isolated fictional demo issues and automated authorization, validation, financial, offline, mobile, backup and migration tests before release.

### Key Entities
- **BodyDamage**: One exterior issue attached to a car, with location, descriptive fields, status and dated history, optional repair/estimate and photo references.
- **Evidence**: Authorized local image with before/after phase; binary remains in existing file storage.

## Success Criteria
### Measurable Outcomes
- **SC-001**: On a 360 px screen an owner can create two distinct issues on one panel, edit, filter, remove and undo with no horizontal overflow.
- **SC-002**: An offline create/edit survives reload and ends as exactly one server record after reconnect/replay.
- **SC-003**: Damage/repair links leave existing expense totals and vehicle odometer unchanged.
- **SC-004**: Backup/restore and upgrades preserve all existing cars, money, settings and attachments plus new issue history.
- **SC-005**: Both languages expose equivalent usable controls; no private photo is displayed without authorization.

## Assumptions
- Generic diagrams first; model-specific illustrations, automated visual diagnosis and insurance estimation are future work.
- Reuse vehicle ownership roles, attachment limits and human-confirmed service history.
- Estimates are optional, use the car currency and do not enter analytics.
- Automated tests are required by the constitution; physical-device validation remains separately disclosed.
