# Research: Reviewed document recognition

## Decision: fixed compatible vision processor, optional and explicit
Use an owner-configured OpenAI-compatible chat-completions endpoint with image content and structured response schema. Ollama documents this subset including vision and response_format: https://docs.ollama.com/api/openai-compatibility and https://docs.ollama.com/capabilities/structured-outputs . A local URL alone does not prove local inference: cloud models can route remotely. Owner instructions must require locally installed vision models and OLLAMA_NO_CLOUD=1 for local-only use: https://docs.ollama.com/faq . Show configured endpoint/model with explicit per-source consent; do not promise accuracy or estimate inference speed on unknown hardware.
Alternative: provider-specific SDK or automatically installed model adds unnecessary dependency/infrastructure. Rejected mandatory cloud and automatic upload. Tests use isolated local HTTP fakes, never live provider requests.

## Decision: isolate PDF rendering in a bounded child
Use pypdfium2 sequentially in a short-lived process. Official Python API warns PDFium is not thread safe and documents page rendering/lifetimes: https://pypdfium2.readthedocs.io/en/stable/python_api.html . Normalize image orientation and reconstruct RGB JPEG without EXIF via Pillow. Render only user-selected pages; inspect metadata/count separately. Reject encrypted/malformed documents and cap pixel size/pages/deadline/output. No native renderer executes in the request thread.
Alternative: browser PDF.js adds a large worker and changes preview/offline caching; text-only extraction fails scanned service orders. Neither meets this slice as cleanly. pypdfium2 wheels include PDFium; dependency/license notices must be retained and Linux image/build tested.

## Decision: actor-private drafts plus existing durable event outbox
Existing Store.mutate accepts an explicit transaction, applies exact normalize_event calculations and receipts; existing IndexedDB queue survives reload/offline and refreshes access before syncing. Add top-level recognition claim validated before receipt replay, and link source/claim after event creation in the same transaction. Unique vehicle/content fingerprint and deterministic event identity block duplicate uploads/confirmations. No recognition API or provider dispatch occurs during queued confirmation.
Alternative: separate confirmation queue duplicates conflict/retry behavior. Arbitrary event JSON provenance alone is forgeable and cannot establish review state or content uniqueness.

## Decision: private persistence with no automatic recovery requests
Store attempts/suggestions/review state, not raw provider response, base64 pages or secrets. Failed/uncertain state is explicit; start requests have stable IDs and do not auto-repeat. Backup includes tables and files; restore validates references/strict data and changes in-progress state to uncertain. Pending UI edits are actor-keyed locally and reauthorize on server sync.

All planning unknowns resolved. Research dispatch was read-only. Official sources inspected 2026-10-12; no provider contacted.
