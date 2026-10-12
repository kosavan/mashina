# Machine data model

Revision 006 follows 005 unchanged.

- **machine_credentials**: UUID PK, user_id FK, unique SHA-256 token_hash, trimmed label 1–80, integer created/expires UTC seconds, nullable revoked timestamp, boolean write_enabled. Default expiry 90 days/max365; max10 active keys. Secret is 32 random bytes URL-safe with prefix, returned once, never persisted. Listings omit verifier and plaintext.
- **machine_vehicle_grants**: credential_id/vehicle_id composite PK + FKs; 1–50 distinct original-owned live cars at issue, fresh ownership on use. Immutable scope, change via revoke/new issue.
- **machine_receipts**: credential_id/external operation UUID composite PK; vehicle_id FK, entity event/reminder, record UUID, SHA-256 payload hash, projected response JSON, created timestamp. Internal shared mutation UUID derives from credential/op IDs. Replay revalidates grant before response.
- Existing audit stores issue/revoke/mutation credential attribution without secret. Add history index `(vehicle_id,deleted,occurred_at,id)`.

Active → revoked/expired, no reactivation. Password/reset/disable/restore permanently revoke. Feature disable denies keys; lost ownership denies car. Validator checks identifiers, hashes, timestamps, booleans, foreign relationships and projected receipt content, preserving existing bank/notification rules.
