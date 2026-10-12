# MASHINA 1.3 validation

Validated on 12 October 2026, Windows x64, Python 3.14 and headless Chromium. This is product polish over 1.2, not a declaration that all planned 2.0 work is finished.

- Backend regression: 178 Pytest passed; an additional vehicle permission/revocation test passed with all 20 product-polish tests (179 total test cases).
- Frontend: 20 Vitest passed; TypeScript, ESLint, Prettier and production build passed. Main entry 130.9 KiB gzip, below 180 KiB.
- Browser regression: all 25 Playwright journeys passed. After final visual/data changes, six affected demo, fuel, notification-isolation, tire and service-location journeys passed again. Tires were verified at 360 px, fuel at 390 px and 1440 px.
- Tire coverage: exact decimal depths, invalid/future inputs, duplicate IDs, old payloads, measured threshold, same-day minimum, offline persistence/reload/single synchronization/edit, owner/driver/revoked access and backup restoration.
- Location coverage: coordinate pair/range validation, local history and backup, zero external map requests before click. Provider content is intercepted in tests; live provider delivery is not claimed.
- Identity: owner-selected Apex M, green-only final artwork. SVG masters, graphite application icons, iOS/PWA/favicon and dark presentation visually inspected. Original black/white exploration is separate from the final kit.
- Hyperframes 0.8.149 strict runtime/layout/motion/contrast checks passed with zero errors/warnings; 1600×900 static PNG inspected. Local editable composition, GSAP license header and font OFL retained. No MP4 export or cloud render.
- Existing financial, migration, backup/file restoration, security and idempotency suites remain included.

Final-head GitHub CI must pass Linux frontend/backend/browser checks, Docker build and container health before merge/tag. The GitHub release links its successful workflow and exact source commit. Source-only credential scan runs before publication and again in CI.

Physical iPhone installation, separate macOS/arm64 Docker hardware and real external notification delivery remain unverified. Address geocoding, receipt OCR, MCP writes, natural-language search, expense-entry Telegram bot, OBD-II and Passkeys are not introduced here. A manually entered service point is not a verified business address; a measured depth/age is not a roadworthiness inspection.
