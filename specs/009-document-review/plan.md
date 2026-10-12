# Implementation Plan: Reviewed document recognition
**Branch**: `codex/mashina-document-review` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

## Summary
Optional bounded image/PDF recognition prepares actor-private drafts. Existing event outbox confirms reviewed data through the ordinary exact financial model; transactional source claims prevent duplicates. No model is installed and no external request is made until configured and explicitly consented.

## Technical Context
Existing React/TypeScript/Vite, FastAPI/Pydantic/SQLAlchemy Core/SQLite monolith. Add pypdfium2 for selected-page rendering in an ephemeral subprocess, Pillow for fresh normalized JPEGs; no browser PDF dependency or always-on worker. Python 3.12+ / Windows development / Linux Docker amd64, arm64 subject to compatible wheels. Additive Alembic revision 007. Configuration comes only from server environment, disabled by default.

Use fixed OpenAI-compatible vision chat completions with structured output, owner-selected model and endpoint; local Ollama supported with cloud explicitly disabled by owner. Default local endpoint literal loopback HTTP; explicit LAN literal HTTP allowed only with local-insecure acknowledgement; remote endpoint HTTPS with verified TLS, bounded response, no redirects/proxy/environment credentials. Destination and model shown before each consent; no client URL/model override. Secrets never returned or logged.

Bounds: upload existing 20 MiB; PDF at most 100 pages inspected, selection 1–5 distinct pages, normalized page longest side 1600 and 2.56 MP, sequential rendering; 30 second child timeout, 120 second absolute provider deadline enforced by a separate ephemeral HTTP child, 128 KiB structured response, at most 100 positions. One active processing attempt per actor, a file lock per data directory serializes render/provider work across processes; no periodic jobs. Child memory limit on Linux where supported, container cap is additional protection. No native PDFium work in app threads. HTTP child uses private stdin for credentials/content, verified system TLS and no environment proxies; a slow-dripping response cannot outlive the absolute parent timeout. Response/inference failure yields explicit failed/uncertain draft and no automatic retry.

Server drafts persist edits and processing provenance; browser IndexedDB persists actor-scoped editing immediately and restores it after reload. Explicit confirm is an ordinary event mutation carrying a top-level recognition source claim (draft id/version); no provider action in outbox. Existing outbox handles pending/error/retry; source identity and permissions are checked inside Store transaction before receipt replay. A deterministic event id per draft and unique vehicle/content claim prevent repeated recording, including different upload IDs. Confirmed source cannot silently be reused, even if its event is deleted; user restores/edits existing history.

## Constitution Check
Pre-research and post-design: I shared exact domain calculations and atomic receipts; II custom document review/source comparison rather than admin CRUD; III monolith plus bounded ephemeral render subprocess; IV local optional processor and no core dependency; V consent, fixed configuration, fresh ACL, private DTOs; VI 360 px/touch/themes/a11y; VII durable actor-scoped edits and existing queue; VIII adversarial/financial/PDF/restore/offline/mobile tests; IX strict interfaces and additive migration; X bounded work/on-demand lazy UI/no polling; XI full archive validation, interrupted attempts become uncertain on recovery; XII verified earlier releases, no invented accuracy claims. No unjustified exception.

## Project Structure
`backend/recognition_models.py` strict suggested/reviewed fields; `recognition_media.py` bounded subprocess launcher and `recognition_worker.py` PDF/image normalization; `recognition_transport.py` fixed destination and bounded request; `recognition.py` draft lifecycle, ACL, atomic claims; `recognition_api.py` same-origin routes; `recognition_archive.py` restore validation; migration007. Extend Store mutation and backup/export hooks. Lazy `frontend/src/DocumentReview.tsx`, typed draft persistence helper, Documents entry point, existing outbox metadata. Tests `test_recognition*.py`, frontend utilities and mobile journeys. Owner guide `docs/document-recognition.md`.

## Delivery and Gates
1. Strict untrusted-output boundary, exact reviewed-data validation and bounded media tests.
2. Migration, actor-private lifecycle, consent-bound processing and safe fixed transport with fake local upstream only.
3. Atomic source confirmation using existing event queue; repeat/concurrency/authorization/odometer tests.
4. Finished source-comparison UI, offline edit/reload/pending/conflict states and headless 360 px verification.
5. Archive/migration/export validation, owner instructions, complete regression/static/build/secret scan/Linux CI and Spec Kit converge.

Read-only research agent dispatched by speckit-plan. Primary findings recorded in research.md. No extension hooks configured.
