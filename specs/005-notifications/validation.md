# Validation — optional notifications

Local checks, 2026-10-12:
- 68 Pytest tests passed, including expired private Telegram codes, interrupted sends without automatic retry, five-attempt rate-limit budget, explicit retry, permission revocation, concurrent claims, pinned HTTPS, real Push encryption through a fake transport, consistent backups and migration from revisions001/002/003.
- 10 Vitest tests passed, including generic service-worker notification content and same-origin click despite hostile payload URLs.
- TypeScript, ESLint, Prettier, Ruff and production build passed. App entry gzip128KB against180KB budget; notification UI loads separately.
- 15 full-regression headless Chromium scenarios passed; a subsequent focused run passed all3 notification scenarios, adding explicit missing-setup/unsupported-browser checks. Coverage includes360px consent, local/server disconnect, isolated demo and existing application journeys. Linux CI result is recorded before merge.
- npm audit reports zero known vulnerabilities after upgrading Vitest to4.1.11.

All provider HTTP operations in tests are intercepted; no real Push/Telegram messages or workstation timer were created. Physical iPhone installation and actual provider delivery require an owner-configured HTTPS deployment and are not claimed as tested. Provider acceptance is never reported as device delivery.

No existing Proxmox services were changed. Source publication excludes runtime data, credential helpers, rendered QA files and secrets.

Linux CI38177245363 passed on87af0e9:68 Pytest,10 Vitest,16 Playwright, static checks, build, Docker image and container health. PR4 merged asf876baca8a6f07bd97ea0af4320cb43ab7c71b9d.
