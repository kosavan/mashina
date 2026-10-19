# Verification and compatibility review

Local evidence on 2026-10-19:
- Windows backend: 298 passed, 12 native OCR checks skipped because Windows lacks Tesseract.
- Linux WSL with locked Python dependencies, actual Tesseract 5.3.4 RU/EN and Poppler: all 58 OCR/release scenarios passed, including the skipped native scenarios.
- Frontend: static/type/format checks, 36 unit tests and production build passed.
- Complete browser regression: 54 passed, including Chromium mobile/offline journeys and WebKit PWA portrait/landscape.
- A 201.07 MiB incompressible archive round-tripped with 4.33 MiB peak traced Python allocation. Corrupt paths/checksums, size limits, incomplete publication, upload cleanup and download disconnects are tested.
- RU/EN/DE PDF examples were rendered to PNG and all six pages visually inspected. No clipping, overlap or missing glyphs found; Cyrillic user values remain unchanged in English/German documents.
- Documentation links/English language, frozen migration fingerprints (8 files) and Ruff passed.

OCR experiments found that enlarging small Manrope digits to 3000 pixels could turn 3 into 5. The primary pass retains a 2100-pixel bound, with a complementary sharpened/Otsu pass up to 2800. Disagreement is a candidate, never an automatic field. Synthetic checks do not establish accuracy on arbitrary owner documents or physical instrument panels.

Compatibility: schema remains 007. Released schema/migrations/frozen hashes are untouched. Legacy machine CSV/JSON and multipart restore remain available; the new frontend uses raw ZIP streaming to the data volume. Prior clients ignore additive OCR result fields. No change to mutation operation IDs, authorization, exact domain arithmetic or durable outbox structure.

Release gate: exact-source CI must pass for publication; consult the attached pull request checks for the commit being released, including the read-only non-root production-image restore/restart drill and real OCR in that image. No owner server or production dataset was changed for these checks. A physical iPhone and arm64 hardware are not certified by these local tests.
