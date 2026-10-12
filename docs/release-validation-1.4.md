# MASHINA 1.4 — validation

## Scope

Local English/Russian UI, pre-auth/setup and account language settings, locale-sensitive formatting, isolated demo presentation, language-matching README screenshots/infographics and footer. No schema migration or currency/unit conversion. User-generated content is preserved. Administrator backup visibility is corrected.

## Local evidence (Windows, 12 October 2026)

- Ruff and 181 Pytest cases pass, including setup locale validation, settings persistence, unchanged user records, money/fuel/odometer, migrations, security and backup/restore regressions.
- TypeScript, ESLint and Prettier pass. All 24 Vitest cases pass, including translation-resource coverage and canonical finance/demo preservation.
- Production build passes: app entry 169.9 KiB gzip, under the 180 KiB budget. Vite's raw chunk-size advisory remains; analytics stays lazy-loaded.
- All 30 Playwright cases pass. Playwright covers existing Russian workflows plus English navigation, all quick-add forms, preserved pre-auth drafts, 360px offline expense/reload/single sync, real account locale changes offline and user text that deliberately matches a translation key.
- Screenshots come from isolated synthetic demo data, with Volvo XC60 selected for both analytics screenshots. No data smoothing or fabricated chart values.
- Both Hyperframes compositions pass lint/runtime/layout/motion checks and 74/74 contrast checks; snapshots at 4 seconds inspected. Assets/fonts/runtime are local. Hyperframes usage lookup returned unknown; no cloud rendering used.

The exact source commit must pass GitHub's Linux/Python/Node/Chromium checks and production Docker build/healthcheck before release publication. The release links that successful run. Only source and synthetic demo assets are published.

## Spec Kit convergence

Assessed the seven acceptance bullets, seven implementation tasks, architecture/data/persistence/demo/screenshot plan decisions and all twelve constitutional principles against the current scoped implementation and tests. No remaining buildable gap was found; tasks.md is unchanged by convergence. Publication remains gated by exact-head CI. Administrator backup visibility is a small corrective change justified by retaining reliable account settings during localization.

## Limits

No physical iPhone/Safari device test, separate macOS Docker or arm64 deployment was run locally. PDF/CSV content and external notification payload languages remain unchanged. No receipt OCR, AI, OBD or external integration is added. Back up data and attachments before updating; existing user settings are backward compatible.
