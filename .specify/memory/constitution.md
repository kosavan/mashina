# MASHINA Constitution

## Core Principles

### I. Data Integrity Over Feature Quantity
Expenses, confirmed odometer readings and service history MUST remain correct under
historical edits, deletions, retries and restores. Financial records MUST never double-count.
Money MUST use exact arithmetic. Forecasts MUST NOT be represented as measured facts.

### II. Premium Design Quality
Mobile UI MUST provide coherent polished iOS-style navigation, typography and feedback.
Every completed screen MUST have designed loading, empty, error and success states.
Generic administrative scaffolding MUST NOT substitute for finished product interactions.

### III. Simple Architecture
The system MUST use a modular monolith unless a documented demonstrated need justifies
more infrastructure. Presentation, domain, persistence and HTTP responsibilities MUST
remain explicit. Dependencies and abstractions MUST solve existing requirements.

### IV. Self-Hosted Independence
Core functionality MUST work on the owner's server without clouds, paid APIs, remote
fonts or mandatory external integrations. All assets and operational data MUST be owned locally.

### V. Privacy and Security by Default
Authentication MUST protect private data and attachments. Public registration MUST be
disabled after controlled initial administrator setup. Passwords MUST be securely hashed;
secrets MUST NOT enter tracked files, test fixtures, logs or public command output.
Permissions, validation and safe file handling MUST be enforced server-side.

### VI. Mobile-First and Accessible
Layouts MUST work from 360 px upward, respect safe-area and reduced-motion preferences,
provide keyboard access and meaningful accessible names, and use touch-friendly controls.
Light and dark themes MUST both be complete. Russian is the default language.

### VII. Offline Reliability
Pending user actions MUST be durably persisted before success is shown. Synchronization
MUST be idempotent; conflicts and failures MUST preserve pending data and be visible.
Background behavior unsupported by the operating system MUST NOT be promised.

### VIII. Automated Testing
Every feature MUST have acceptance criteria and appropriate tests. Automated checks MUST
cover money, fuel cycles, odometer corrections, authorization, backup/restore, migrations,
offline synchronization and critical journeys. Tests MUST assert behavior rather than
mirror implementation. Unavailable checks MUST be reported honestly, never marked passed.

### IX. Maintainability
Interfaces MUST be typed, modules focused, database changes migrated and design decisions
documented. Clear names, automated formatting/static checks and reproducible locked
installs MUST accompany application code. Unrelated refactoring MUST be avoided.

### X. Low-Power Performance
The application MUST target an older low-power home server. Unnecessary background
services, polling and expensive dependencies MUST be avoided. Analytics and large
previews MUST load on demand; long histories MUST be paginated or virtualized.
Performance budgets MUST be measured with documented workloads.

### XI. Operational Durability
Docker data MUST use persistent mounted storage. SQLite backups MUST be consistent and
include attachments; restore MUST be tested. Schema evolution MUST preserve existing
history, with a recovery path before destructive migration. Users MUST be able to export
the full archive without dependence on the developer.
Every release MUST preserve supported installed databases, attachments, settings,
stable operation IDs and pending offline actions. Migration revisions already shipped
MUST remain immutable. Startup MUST refuse unknown/newer schemas and preserve a
consistent recovery snapshot before upgrading an existing schema. Releases MUST test
upgrades from every supported schema and repeat startup without duplicate changes.
Breaking changes require an explicit versioned migration, recovery procedure and
release notice; silently resetting data or requiring reinstallation is forbidden.
Update instructions MUST identify the target release, backup, verification and rollback
steps on Linux, macOS and Windows. Rolling back code alone after a schema change MUST
NOT be described as safe; use the matching pre-upgrade backup and previous image.

### XII. MVP Discipline
Essential features MUST be implemented and verified before optional integrations.
Completed features MUST NOT use placeholder functionality, mock data presented as real,
or non-functional controls. Features MUST trace acceptance criteria to implementation
and verification evidence. Scope exceptions MUST document reason, impact and follow-up.

## Quality and Data Constraints
Core money and mileage calculations MUST be shared across reports. Input validation
MUST occur at trust boundaries; errors MUST be actionable. User data MUST be collected
only for specified purposes. Destructive actions MUST have proportional confirmation or
recovery. Infrastructure access MUST follow the user's workspace instructions.

## Development Workflow
Specify user outcomes and acceptance criteria, plan the architecture and data contracts,
create independently testable vertical-slice tasks, implement, and run convergence.
Record remaining work as tasks and repeat until required behavior has evidence.
Each review MUST assess scope, correctness, data safety, accessibility and verification.
Each change MUST review upgrade and offline-client compatibility, update the roadmap
when product status changes, and maintain English/Russian user documentation. Release
checks MUST include migration, backup/restore and production-container durability tests.

## Governance
This constitution governs feature artifacts and implementation, subject to explicit user
instructions and higher-priority execution constraints. Amendments MUST record reason,
impact and migration. MAJOR denotes incompatible rules/removals, MINOR new or expanded
obligations, PATCH non-semantic clarification. Review compliance at planning/convergence.
Preserve the original ratification date; update amendment date and version on change.

**Version**: 1.2.0 | **Ratified**: 2026-10-11 | **Last Amended**: 2026-10-12

