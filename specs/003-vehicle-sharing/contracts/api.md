# Contracts
Session gains is_admin. Vehicles/events/attachments gain can_edit; vehicles gain role/is_original_owner; files gain visibility/can_share. State is authorization-scoped.
GET/POST /api/v1/users administrator only; PATCH /users/{id} {disabled?,password?} disables/resets credentials without returning a hash/password.
POST /api/v1/password {current_password,password} rotates the current user's credentials and invalidates old sessions, returning a fresh session.
GET /vehicles/{id}/access returns original_owner, members and active account candidates (IDs/usernames only) to car owners.
PUT /vehicles/{id}/access/{user_id} {role:owner|driver} grants or changes access; DELETE revokes it. Cannot remove original owner.
Attachment upload is owner-visible by default. PATCH accepts visibility owner/shared; changing visibility is owner-only. Cover selection explicitly shares that image. Inline/download uses the same read policy as state metadata.
Mutate checks current rights even for saved receipts. Bulk import/ownership reports owner-only. Full backup/restore admin-only. Scoped JSON/CSV available to real authenticated users.
