# Decisions

- Local explicit translation calls avoid DOM mutation/reconciliation bugs and preserve drafts. An extensible ru/en Locale union and resource catalog permit later locales.
- Built-in category identity is Russian canonical data today. Translate its display only; preserve option values. Custom text and real vehicle records remain unchanged.
- Account locale uses existing settings storage and queue; setup validates supported locale, old data need no migration.
- Demo text is a synthetic-fixture-only projection. Localization never rewrites real history.
- Three terminology research agents provided 958 UI resources and350 additional server/demo resources. Context audit corrected “Расход” to Expense and differentiated absolute odometer and period distance.
- Fuel cycle aggregation groups by car correctly, but all-car lines concatenate their dates. Requested screenshots select one car; no smoothing, fabricated values or unrequested chart aggregation change.
