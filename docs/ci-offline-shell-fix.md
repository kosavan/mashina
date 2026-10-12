# Offline shell regression and CI repair

The intermittent localization failure on `main` was a real offline UI defect.
After entering Settings and disconnecting, a lazy `MachineAccess` module could
still be loading. Its failed import escaped Suspense and left the application
blank. The English heading assertion was the symptom, not a slow translation.
The failure reproduced in all six attempts with Chromium CPU throttled to 6×.

The generated service worker now precaches the entire public Vite assets
directory, including lazy modules and bundled fonts. The cache version includes
the content of those assets. Lazy JavaScript execution remains deferred; the
initial offline shell download grows to approximately 1.7 MB of build assets.
API responses and user attachments are not added to the shared shell cache.

Regression coverage checks the actual build script with nested assets and a
private-file exclusion, opens previously unvisited Settings and Analytics while
offline, and retains the real-account locale/sync journey with 6× CPU throttling.
No test retries, assertion removal or timeout increases were used. Failed browser
runs now retain synthetic-test screenshots/traces in GitHub Actions for seven days.

Local validation: TypeScript, ESLint, formatting, 25 Vitest tests and production
build. The entry remains 173.7 KiB gzip within the existing 180 KiB budget.
Full browser and Linux/container results are recorded in the fix pull request.
