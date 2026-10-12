# /api/v1/bank contracts

Session all endpoints, CSRF writes, owner-role car check. 403 denied, 409 conflict/stale, 422 invalid.

- GET sources?vehicle_id: current actor sources.
- POST sources {vehicle_id,label}: stable private source ID/label; normalized label reused.
- POST inspect multipart file/vehicle_id/encoding(utf-8|cp1251)/delimiter(comma|semicolon|tab): headers/count only. 2 MiB/1000 rows/50 columns; duplicate/empty headers or ragged rows rejected.
- POST preview same file plus source_id/mapping JSON: date/amount/description columns, optional transaction_id/currency; explicit date_format(iso|russian), outgoing_sign(negative|positive), default_currency(RUB|EUR|USD). Returns immutable batch_id/expires and rows with row_id, mapped data/error, prior/conflict, overlap, five candidate id/version/kind/date/amount/currency/description and total count.
- POST commit {operation_id,batch_id,decisions:[{row_id,action:create|link|ignore,event_id?,expected_version?,category?,description?,ack_separate:false}]}: 1–1000 unique row decisions, unset omitted. Atomic response counts/created event IDs/vehicle_id. Same payload retry returns receipt after fresh authorization even if batch expired.
- GET export?vehicle_id: private JSON sources/ledger, no previews/raw files/unmapped columns.

Online-only. Demo same implementation on isolated Store.
