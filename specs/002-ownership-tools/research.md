# Research decisions
Reuse reviewed MVP storage/security/offline decisions. Python stdlib csv supports quoted multiline fields and explicit delimiters; reject unknown column schemas and normalize Decimal amounts before review. Source: https://docs.python.org/3/library/csv.html
SQLite additive tables preserve existing data; frozen initial revision remains unchanged. Source: https://alembic.sqlalchemy.org/en/latest/ops.html
CSV canonical row UUID5 is independent of file position so reordered duplicates remain duplicates. Explicit source IDs permit conflict detection for altered rows rather than silent overwrite. Scope keys include owner and selected vehicle.
Tire usage is a history of user-confirmed mount/unmount intervals. Closed distances are measured; open intervals may use a separately labelled observed odometer, never technical wear percentages.
