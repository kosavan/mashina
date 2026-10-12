# Data model

UUID IDs, integer minor units, ISO dates, SHA-256 hashes, foreign keys. Actor is importing user, distinct from vehicle resource owner.

- bank_sources: id PK, actor_id FK users, label (1–80 characters), normalized_label; unique actor/normalized_label. No credentials.
- bank_preview_batches: id PK, actor_id/source_id/vehicle_id FKs, file_hash, rows_json mapped only, created/expires UTC seconds. TTL 1800 seconds; maximum three active batches per actor; all deleted on restore.
- bank_ledger: id PK, actor_id/source_id/vehicle_id FKs, identity unique(source_id,identity), fingerprint, file_hash, row_ordinal, normalized_data, event_id nullable FK events, decision enum create/link/ignore, created. Unique non-null event_id. Canonical bank data separate from reviewed expense description. Ignore may record incoming/zero, never creates money. Deleted events do not free bank identity.
- bank_commit_receipts: composite PK actor_id/operation_id, batch_id string (not FK so previews may expire), payload_hash, response JSON, created. Replay checks current car rights using response metadata. Different digest conflicts.

No event contains bank IDs/source/raw file. Actor-private export includes sources and ledger for currently owner-accessible car only. Full admin backup includes private ledger; general shared export does not.
