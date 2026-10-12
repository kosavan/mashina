# Quickstart validation
No real provider is required for tests. Use isolated generated image/PDF fixtures and a fake local compatible endpoint.

1. Run backend recognition tests, financial regression and migration/restore tests with `.venv/Scripts/python.exe -X utf8 -m pytest -q backend/tests`.
2. Run frontend check/tests/build and headless Playwright after build. At360 px verify consent, source review, incomplete-data errors, exact service/fuel values, repeat confirmation, reload/offline recovery and both themes.
3. Default environment: ordinary docs/expenses work; recognition reports disabled; no worker or outbound call starts.
4. Owner-only manual setup uses optional configured local vision service with cloud disabled, explicitly selects a document/pages and starts after destination disclosure. This is optional verification, never required against the user's real documents.
5. Create and restore a full backup containing generated source/draft/confirmed event; compare file hashes and exact totals; verify processing never automatically resumes.
6. Run source secret scan, complete Linux CI/Docker health and Spec Kit converge. Record actual results in validation.md; do not mark pending checks passed.
