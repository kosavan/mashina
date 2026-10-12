# Validation guide

Disposable local data/synthetic cars only; no external provider or owner credentials.

1. Run `.venv/Scripts/python.exe -X utf8 -m pytest backend/tests/test_machine_access.py backend/tests/test_machine_protocol.py`: lifecycle, operation namespaces, strict fields, authorization, restore and real STDIO subprocess behavior.
2. Run full backend pytest, frontend npm test/build and Playwright. Preserve existing money/bank/attachments/notifications; history25/10000 fixture <1second.
3. Disposable server MASHINA_API_ENABLED=1: original owner issues read key for one of two cars. Copy once; reopening cannot retrieve secret. Foreign car/write denied. Never put key in URL/tracked files.
4. Write opt-in key: one expense + retry yields one entry; changed payload/stale edit409. Revoke/password/restore each blocks later use.
5. Local adapter: modern discovery and legacy initialize, four read tools/no writes, clean EOF/cancellation, bounds and redaction. No cloud connection.
6. Headless360px dark/light copy fallback/revoke/offline/error screenshots; tracked-source secret scan, Linux Docker CI, then Spec Kit converge.

Owner setup will be documented in docs/machine-access.md during implementation. This guide defines checks, not claims that they passed.
