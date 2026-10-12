# Release 1.2.0 verification

Freeze requested by the user on2026-10-12: publish already finished behavior and stop expanding scope. Stable source is based on merged bank/API/MCP slices; unfinished009 recognition is preserved only in codex/mashina-document-review and excluded from this release.

## Local final-version checks

-159 Pytest passed in17.14seconds: financial/fuel/history, authorization/CSRF/files, demo isolation, offline-related mutation idempotency, ownership/sharing, PDF/privacy, notification transport/restore, bank atomicity/duplicate safety, migrations001–006, SQLite/file backups and machine API/MCP subprocess/security tests.
-17 Vitest passed; TypeScript, ESLint and Prettier passed. Production build passed, initial JS 129.1KiB gzip versus180KiB budget. Analytics/bank/API screens load lazily.
-All21 headless Playwright journeys passed in31.8seconds on the production bundle: mobile360px, both themes/all primary screens, forms/edits/delete undo, durable offline reload/retry/conflicts, files/reminders, tires/CSV/bank review, scoped credentials, accounts/revoked drafts, PDF disclosure, forecast and notification consent.
-Generated desktop dark, mobile light and mobile bank dark screenshots inspected. Existing custom product UI preserved. All browser data/files/screenshots stay in ignored .cache; no visible windows or real provider calls.
-Low-power fixtures:10000-event analytics under1second; bank1000rows×10000events under2seconds; first25machine-history records from10000 under1second. These are test-environment budgets, not hardware benchmarks on the owner's server.

## Spec Kit convergence at freeze

No extension hooks configured. Prerequisites loaded separately for007 and008. Assessed their current spec/plan/tasks, domain/security/transport/mobile code and passing test evidence:007 has6FR/6SC/11acceptance scenarios/15tasks;008 has7FR/6SC/15acceptance scenarios/21tasks. All12constitution principles checked. No new missing/partial/contradictory requirement within these completed slices; no tasks appended. Converge leaves task files byte-for-byte unchanged:

-007 tasks SHA256390ff2a8b2d887481bb9799eb18ed1671585fb89c4b4f66f17d926351b1fc68a
-008 tasks SHA256acc3dda01ca8eb3170d3fa62c0246d24c92b840a6961a00df454ed7a922478b2

Earlier001–006 completion/convergence evidence remains in their specifications and published1.1 release; their regression journeys pass again. All117 tasks in001–008 are checked. This does not mean optional009/future2.0 requirements are complete. User explicitly deferred them; release notes and testing guide list remaining work.

## Publication gate

Tracked-source secret/runtime scan passed for225 files. Require successful final-head Linux CI (backend/frontend/mobile, Docker build and persistent health initialization) before merging/tagging. Release publication helper must verify exact-head checks and use that commit as tag target; attach CI/source links in GitHub release notes. Docker is unavailable locally; no local container success is claimed.

Physical iPhone installation/Push, actual third-party delivery and separate arm64 hardware have not been tested. No changes to existing Proxmox infrastructure or deployment of private data were performed. Persistent test-server files are not published.
