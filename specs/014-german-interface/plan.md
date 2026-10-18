# Implementation plan

Extend the existing local resource architecture with typed ru/en/de support,
German UI/demo catalogs and de-DE formatting. Add de to setup and settings
validation without changing persisted schema or operation contracts. Keep a
separate public locale chunk under the existing app-shell cache, preserving the
main-entry size guard and offline availability.

Validate resource parity/parameters and unknown locales, preserved user content,
offline expense/language replay, restore/restart and existing RU/EN journeys.
Update active English/Russian documentation, add German introduction and safe
update instructions and record request #20 in both roadmaps. Gate publication
on full exact-source CI; publish v1.7.0, then answer the author with verified links.

Compatibility review: additive accepted locale value only; no schema revision,
dependencies or infrastructure changes. Old payloads retain defaults and existing
financial operations/IDs. Update server/frontend together because old servers
reject de. Restore matching prior data/image for rollback. Do not translate user
records or change currency/units. Output/PDF/notification/OCR scope stays explicit.
