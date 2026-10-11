# Validation — MASHINA MVP

Date: 2026-10-11. Environment: Windows, Python 3.14, Node 20.18, Chromium headless.

- pytest: 15 passed. Exact financial items, fuel derivation/full/partial/gap cycles,
  currency separation, ownership mileage, reminders, controlled setup, CSRF,
  idempotency/version conflicts, historical mileage, isolated demo, ZIP restore
  with byte-identical images, corrupt/traversal rejection, migration restart,
  and 10,000-event analytics budget.
- Vitest: 7 passed, including exact optimistic item/fuel totals.
- TypeScript, ESLint, Prettier and Ruff: passed.
- Vite production build: passed. Main JS 126.3 KB gzip, under 180 KB budget;
  charts load separately. Fonts and assets are bundled locally.
- Playwright: mobile expense/edit/delete/undo; offline persisted reload and
  exactly-once delivery; offline create then edit; visible version conflict with
  explicit server-version choice; vehicle/document/reminder flow; demo charts;
  all primary screens at 360 px and light theme.
- Visual review: desktop garage and analytics, mobile garage, generated demo
  vehicle photographs. Screenshots remain local in `.cache/screenshots`.

No physical iPhone was available: installation, safe-area/keyboard behavior and
the 10–20 second human-entry target require device acceptance. Desktop browser
automation is not evidence of those measurements. Docker is not installed on
this workstation; the Linux container build and health check run in GitHub CI.
Performance budget tests are measured on this workstation, not the user's home server.

Spec Kit convergence identified pending-money accuracy, cost-per-km trend and
additional mobile/conflict tests; the remediation tasks are T031–T033.
Future release features are deliberately not presented as MVP functionality.
