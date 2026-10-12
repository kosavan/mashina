# Same-origin recognition contract
Session cookies and CSRF for writes; never bearer namespace. Demo has enabled=false and no provider dispatch. All errors omit private provider payloads and credentials.

GET /api/v1/recognition/config -> enabled, configured destination/model label, limits and server-side readiness/error. No secret.
GET /api/v1/recognition/source/{attachment_id} -> authorized media/page count plus existing draft or claimed event, no processing.
POST /api/v1/recognition/start -> operation_id, attachment_id, selected_pages, config_revision, consent=true. Fixed endpoint/model; unknown fields rejected. Stable repeated request returns its attempt, never resubmits. Explicit new operation needed after failed/uncertain state. Processing outside transaction rechecks access/config on result; no financial changes. Bounded one-active-actor policy.
GET /api/v1/recognition/drafts/{id} -> actor-private draft, warnings/revision/status.
PATCH /api/v1/recognition/drafts/{id} -> expected_version, reviewed fields; optimistic conflict retains user edits.
GET /api/v1/recognition/drafts?vehicle_id=... -> actor-only bounded latest drafts; paginate if needed.

POST /api/v1/mutate existing event create contract accepts optional top-level recognition {draft_id, expected_version}. Existing stable operation/event ids and offline outbox used. Source claims require actor-private review draft, current source access, matching car, reviewed typed data; all financial calculations and odometer warnings shared. Before receipt replay reauthorize. In one transaction persist event, link source, mark draft confirmed and insert unique content claim. Return ordinary record. Conflicts return existing event metadata only when accessible, never auto-create separate operation. Machine/bank imports cannot forge recognition through ordinary event JSON.

Transport: fixed server environment URL/model/key, no body URL overrides, no tools/function calls, no streaming. Serialize only selected normalized JPEGs and extraction instructions/schema. Strict structured output and size/time bounds. Redirects rejected; TLS verified; LAN HTTP requires explicit owner acknowledgement. All provider integration tests use fake local server.
