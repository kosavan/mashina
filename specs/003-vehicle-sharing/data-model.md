# Model
User: is_admin bool, disabled bool. A migrated single installation owner becomes admin; new setup admin explicitly set.
VehicleAccess: vehicle FK + user FK composite PK, role owner/driver. Initial owner remains vehicles.owner_id; delegated grants cannot remove that control.
Event.created_by and Attachment.created_by: immutable actor FK backfilled from old owner_id. Payload cannot override columns.
Attachment.visibility owner/shared: default owner. Vehicle cover assignment deliberately makes that image shared, with UI explanation.
Receipts.owner_id = actor, not car owner. Audit.owner_id = actor. Financial event owner_id = vehicle owner; exactly one event regardless of actor.
All API state rows carry server-computed capabilities, never client-authoritative permissions.
