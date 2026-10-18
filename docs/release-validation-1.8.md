# MASHINA 1.8 validation

Scope: [specification](../specs/015-mobile-ocr-languages/spec.md).

Local evidence on Windows:

- 265 backend tests pass; nine actual-engine cases await mandatory Linux native OCR
  and Poppler. This includes existing financial, authorization, upgrade, restore
  and offline-operation contracts, eight locale validators and private preview tests.
- 34 frontend unit tests pass. All eight catalogs cover 1,502 UI keys; new demo
  catalogs retain the 30 canonical fixture keys. Parameter indices and user text
  are preserved. Five additional language/offline/mobile journeys pass.
- New OCR browser coverage checks explicit crop/rotation/pages, unchecked suggestions
  and one exact financial save from selected items. Browser interception tests UI;
  native engine fixtures test real OCR separately, without interception in production.
- Installed-PWA header/menu/navigation pass in portrait and landscape using Chromium
  and WebKit with 440x956/956x440 layouts and injected safe-area dimensions.
  This verifies layout mechanics, not a physical iPhone installation.
- Previews reduce a synthetic existing cover by more than 40%, retain original
  hashes/IDs/download bytes, enforce authorization even on conditional requests and
  rebuild after archive restore. Phone EXIF rotation is tested on new uploads.
- Main JS entry is 83.7 KiB gzip against the unchanged 180 KiB guard. New full
  language catalogs load on demand; the shell precaches public chunks for offline use.

Full existing browser regression, documentation/migration/source scans and exact-source
Linux/native OCR/browser/read-only non-root container CI gate publication. CI restore
also checks a new language preference and rebuilds a preview without changing its source.

No schema revision, runtime dependency or required configuration change. Frozen
initial schema and released migration fingerprints remain unchanged. Existing
single-page OCR requests and original attachment endpoints retain their behavior.
Complex invoice/tax/discount layouts and difficult instrument displays remain manual
or research; OCR is rus/eng even when another interface language is selected.

Deployment to the owner's existing installation is separately authorized. Preserve
old source/config/image and a stopped complete private data snapshot before replacement;
verify database/attachment integrity and matching IDs/hashes after restart. Do not
publish real data, private configuration or backup archives.
