# Validation evidence — in progress

2026-10-12 foundation checkpoint, not a finished feature or2.0 release.

- Spec Kit specify/plan/tasks completed:9FR,13acceptance scenarios,6SC and20tasks; quality checklist16/16 passed read-only implementation gate. Research agent dispatched and primary Ollama/PDFium sources reviewed. No hooks configured.
- T002/T003:35 strict untrusted-suggestion/reviewed-money tests passed after initial missing-module failure. Missing values retain null; unknown authority fields, ambiguous/duplicate JSON, non-exact or invalid numbers fail. Expense/service item discrepancies require correction; fuel shares exact calculations.
- T005/T006:13 real ephemeral image/scanned-PDF rendering tests passed after fixing explicit PDFium page/bitmap lifecycle (PdfPage is not a context manager). Generated sources only; encrypted/malformed/invalid pages/animation/EXIF/alpha/geometry/deadline behavior verified. Optional PDFium wheel locked; ordinary Docker build excludes it, recognition build argument explicitly includes it. Native child resource limits are documented accurately (Linux only).
- Transport module is implemented and26 synthetic transport checks cover fixed local/remote configuration, LAN acknowledgement, no environment proxy, no redirects or retries, strict response/truncation/tool output handling and absolute120second process timeout. Credentials are private stdin only. No real model/provider was contacted. T007/T008 remain open until live lifecycle/consent/configuration/TLS tests and environment integration are complete.
- Earlier complete backend regression:207 tests passed before transport addition; final checkpoint regression/CI recorded below when actually complete.
- No recognition UI or API is exposed yet; ordinary app behavior unchanged. Draft lifecycle, migration, atomic confirmation, offline review, mobile UI, restore/export and final convergence are outstanding in tasks.md.
