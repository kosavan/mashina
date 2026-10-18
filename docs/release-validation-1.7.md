# MASHINA 1.7 validation

German interface following [request #20](https://github.com/kosavan/mashina/issues/20).
Scope and acceptance: [specification](../specs/014-german-interface/spec.md).

Local verification completed on Windows; exact-source Linux CI is required before
publication and exercises the native engines and production container.

- 1,481 German UI resources and 30 isolated demo resources; catalog key parity,
  nonempty values, no unexpected Cyrillic and matching parameter indices.
- UI resources, parameterized server errors, German dates/numbers and RU/EN/DE
  switching; user text and canonical finance fields remain unchanged.
- Backend regression: 241 passed, including a German preference/data
  backup/restore/restart case. Six native OCR cases skipped on Windows because
  Tesseract/Poppler are unavailable; mandatory Linux CI exercises actual engines.
- 29 frontend unit tests and all 41 browser scenarios passed, including existing
  Russian/English workflows, upgraded IndexedDB queues and three German journeys:
  demo/navigation/forms/body map, 360px offline expense/reload/single replay, and
  setup/offline account language/reload with preserved user text and preferences.
- TypeScript/ESLint/Prettier, Ruff, documentation links/English text, eight frozen
  schema/migration fingerprints, source-secret scan and public site build/check pass.
- Main JavaScript is 134.9 KiB gzip against the unchanged 180 KiB limit; public
  bundled catalogs are 85.5 KiB gzip, precached for offline language switching.

No schema/configuration/dependency change from 1.6.0. Released migrations and frozen
initial schema remain immutable. Old payloads and offline financial operation IDs
are retained; old servers reject de preferences, so update frontend/backend together.
Rollback uses matching pre-update data/image. Physical iPhone/arm64 verification
remains open. PDF/CSV output and external notifications retain their existing
language; OCR still uses Russian/English data.
