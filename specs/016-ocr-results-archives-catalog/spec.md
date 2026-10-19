# OCR, localized results, large archives and vehicle selection

Accepted 2026-10-19. Scope: all four user requests; Home Assistant remains separate.

## Acceptance
- Local receipt/service/screenshot OCR uses bounded complementary recognition passes. Ambiguous values are explicit selectable alternatives, never silently applied. Service lines preserve exact quantities, tax-inclusive/exclusive totals and monetary/percentage discounts only when arithmetic reconciles. Unsupported rows stay visible as source text. Evaluate seven-segment odometers without claiming a universal decoder.
- Sale PDFs, readable CSV and generic notifications support RU/EN/DE. User text, IDs, money, machine JSON and legacy CSV remain unchanged. Other UI languages use documented English output fallback.
- Format-1 ZIP archives over 200 MiB round-trip with chunked file IO, ZIP64, bounded memory, checksum/path/size validation, consistent SQLite and rollback-safe recovery. API, CLI and upgrade snapshots use disk-backed archives; no schema change.
- Searchable dependent local make/model/engine suggestions work offline and allow arbitrary manual input. Existing custom values survive edits; suggestions do not certify year/trim/parts compatibility.

## Compatibility
Schema remains 007 and released migrations/fingerprints are immutable. No migration, ID or offline-operation format change. OCR only produces drafts for explicit review. Never translate saved user data.
