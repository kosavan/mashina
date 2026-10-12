# Maintenance audit: MASHINA 1.5.1

Date: 2026-10-12. Scope: existing backend invariants, browser/offline workflows,
installed-data compatibility, backup/restore, English user documentation and known
dependency advisories. This is a regression/code review, not an independent penetration test.

## Findings and fixes

| Finding | Impact | Repair / evidence |
|---|---|---|
| Restore staging used the data volume's parent | Read-only production image could not restore; cross-volume moves could fail | Stage inside data; actual non-root read-only-container drill |
| Initial file swaps were outside recovery handling | A failed second rename could leave the live DB displaced | Guard all swaps; four injected failures preserve original files/history |
| Partial settings replaced all preferences | Language updates could drop other saved/future settings | Merge allowed fields into stored settings; frontend sends only locale |
| Startup migration had no pre-upgrade snapshot/explicit future-schema guard | Recovery and downgrade errors were unclear | Snapshot installed schemas before change; refuse unknown/newer/unversioned databases |
| Small fonts were inlined despite self-only font CSP | Browser blocked some bundled fonts | File assets with unchanged CSP; browser console regression |
| English README linked to Russian instructions | Inconsistent onboarding language | English guides, separate Russian files, CI Cyrillic/local-link check |
| Upgrade instructions omitted target selection/complete rollback | Code-only downgrade could be mistaken for safe recovery | Explicit tags, stopped backup, cold directory copy, previous image and checks |

## Coverage and review

- Real frozen Alembic schemas 001–006 are created and upgraded; assertions preserve
  password hashes, settings, expense minor units, mileage, original authors, files,
  stable IDs and idempotency receipts. Repeated startup is harmless. An interrupted
  migration leaves a complete pre-migration snapshot that is actually restored in a test.
- Released migration/schema fingerprints are checked in CI; add new revisions rather
  than editing a shipped definition. No schema revision is added in this patch.
- Existing financial/fuel/odometer, authorization, sharing, import, notification and
  machine API tests are retained. Browser journeys retain explicit offline/reload/replay
  verification. No retries, weakened assertions or increased timeouts hide failures.
- A representative earlier v1 IndexedDB cache/outbox envelope is loaded into the
  current client offline, survives reload, synchronizes once and accepts an identical
  replay without creating a second expense.
- Full npm audit (including development dependencies) and pip-audit of the installed
  Python environment returned no known vulnerabilities on this date. These are
  point-in-time advisory checks, not proof of absence of security defects. Native
  container OS/OCR packages were not independently vulnerability-scanned.
- Local Windows: 210 backend tests pass, six native OCR cases skip because local
  engines are unavailable; Linux CI requires those real engines. Frontend unit/static
  checks and production build pass. Final browser/container counts and run URLs belong
  in the release/PR after CI succeeds, not inferred from the local skips.
- Constitution 1.2.0 expands operational durability and release review obligations.
  No old principle is removed; migration, compatibility and bilingual roadmap upkeep
  are explicit requirements. PR checklist and CI enforce the corresponding checks.

## Remaining limitations

Physical iPhone, Windows/macOS Docker Desktop, arm64 hardware, actual external
notification delivery and a low-power home-server benchmark still require hardware
validation. Restore accepts at most 200 MiB compressed/expanded archives; streaming
large archives is future work. CLI backups require stopped writers for file/DB
consistency. Snapshot retention under `data/upgrades` is manual and local; copy off-disk.
Concurrent multi-version deployment is unsupported. Existing frozen migrations are
protected, but future compatibility still needs review and tests for every release.

Product work remains in the [maintained roadmap](roadmap.md), with separate shipped,
planned and research status. This audit changes no running server infrastructure.
