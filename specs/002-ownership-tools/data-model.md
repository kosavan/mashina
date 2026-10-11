# Data model
All added records have UUID id, owner FK, vehicle FK, integer version, soft-delete flag and JSON payload.
TireSet: brand/model/size, season summer/winter/all, intervals [{mounted_at,mounted_km,removed_at?,removed_km?}], notes. Non-overlapping intervals; removed km >= mounted km; one final open interval permitted. No financial amount is created.
Budget: month YYYY-MM, amount_minor, currency, optional category. Actuals derived from active events for exact month/vehicle/currency/category.
RecurringCost: title, amount_minor, currency, next_date, interval_months (1–120), category, enabled. Pure 12-month projection; no event insertion.
Parts catalogue derives from active maintenance.items only and retains event ID, date, odometer, article, quantity and minor amount.
CSV: external_id optional, occurred_at, kind, amount, description, category, odometer optional; fuel rows also liters/price/full/gap/fuel/station. Vehicle comes from explicit selection, never arbitrary imported access fields.
