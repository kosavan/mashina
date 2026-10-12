# Data model

Additive revision007 follows006; no destructive downgrade.

## recognition_drafts
UUID id, actor_id users FK, vehicle_id vehicles FK, attachment_id attachments FK nullable on source deletion, content_hash SHA256, selected_pages JSON (one-based, distinct, max5), processor_label (safe configured origin/model), status pending/processing/review/failed/uncertain/confirmed, version positive integer, proposed JSON strict nullable fields, warnings JSON bounded strings, event_id events FK nullable, created/updated timestamps, attempt_id UUID and consent_version/config fingerprint. Index actor/updated. Source bytes remain exclusively existing uploads. Original source may be deleted; retain hash/provenance but disallow confirmation until valid source recovered. Never cascade-delete financial history.

## recognition_claims
Composite PK(vehicle_id, content_hash), draft_id unique FK, event_id unique FK, actor_id FK. Claim exists only after explicit valid confirmation; source attachment.event_id is linked in same transaction. Claim survives soft deletion of the event. Existing receipts establish exact operation idempotency.

## DTOs and state transitions
SuggestedData is strict extra-forbid: optional expense/fuel/maintenance kind, date, currency, decimal strings amount/liters/price, integer odometer, textual vendor/description/station/fuel/category, optional full-tank indication, item list (name, part_number, quantity, unit_price, discount all nullable when uncertain). No identity, permission, confirmation, links, HTML or instructions accepted as capabilities. Missing fields do not acquire domain defaults until human review supplies required data.
ReviewedData requires explicit type/date/currency and valid positive money or fully priced positions; fuel requires odometer and any two consistent fuel values. Shared normalize_event performs exact final calculations. Human-confirmed odometer correction is separate explicit browser decision; processor cannot set it.

pending -> processing after consent/config/ACL validation; processing -> review on strict result; processing -> failed/uncertain on validation/network failure. review -> review via optimistic edits. review -> confirmed via queued explicit event mutation + source claim. Restored/interrupted processing -> uncertain, never dispatch. All read/write/replay operations reauthorize actor and live source/car; another actor never sees the draft.
