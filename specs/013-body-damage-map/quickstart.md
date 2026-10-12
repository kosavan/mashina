# Validation guide
Run from repo root: `.venv/Scripts/python.exe -m pytest backend/tests/test_body_damage.py backend/tests/test_upgrades.py -q`.
Frontend: `cd frontend`, `npm run check`, `npm test`, `npm run build`,
`npx playwright test tests/body-damage.spec.ts`. Tests use synthetic isolated data.

Open a car profile at 360 px. In Body & damage switch views, click a panel, add two
issues, edit location, filter statuses and undo deletion. Keyboard and list paths
must work without a pointer. Switch EN/RU and light/dark, confirm no horizontal overflow.

Offline: create/edit a marker, reload, reconnect; verify one ID/versioned record.
Online: attach before/after photos, link a service expense, mark repaired then reopen;
verify status history and unchanged expenses/mileage. Delete linked evidence and
verify a useful unavailable state. Archive/sell the car and retain damage history.

Run full CI: frozen hashes/docs/secrets, Pytest including actual 001–007 upgrade paths,
Vitest/Playwright, production build, read-only non-root container backup/restore and OCR.
Before release update version/docs, converge against every FR/SC, review source-only
changes, merge with exact-head green CI and publish only after main CI passes.
