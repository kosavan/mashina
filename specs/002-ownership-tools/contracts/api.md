# API contracts
Existing /api/v1/state gains tire_sets, budgets, recurring_costs arrays.
POST /api/v1/mutate supports tire_set/budget/recurring_cost with existing stable UUID, expected_version, audit and receipt guarantees.
GET /api/v1/ownership?vehicle_id=...&month=YYYY-MM returns derived parts, budgets actual_minor/remaining_minor, 12-month forecast and reminders with known km deadlines.
POST /api/v1/import/csv/preview multipart file + vehicle_id returns normalized rows, stable operation IDs, duplicate flags and validation errors. No writes.
POST /api/v1/import/csv/commit JSON {vehicle_id,rows:[normalized source rows],confirm_odometer:boolean} revalidates entire selection before transaction, then persists selected new rows. Repeated request reports existing results; altered source ID is conflict. All endpoints require authenticated ownership and CSRF for writes.
