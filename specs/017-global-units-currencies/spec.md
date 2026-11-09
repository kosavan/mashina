# Global unit and currency settings

Accepted 2026-11-09. Scope: global default currency and per-vehicle currency inheritance (#29, #30), global distance units (`km` / `mi`), fuel volume units (`l`, `gal_us`, `gal_uk`), and independent fuel consumption units (`l_100km`, `mpg_uk`, `mpg_us`, `km_l`, `l_100mi`). CSV fuel-table column mapping (#31) remains planned separately.

## Acceptance
- Owners can configure global default currency, distance unit (`km` / `mi`), fuel volume unit (`l` / `gal_us` / `gal_uk`) and independent fuel consumption unit (`l_100km` / `mpg_uk` / `mpg_us` / `km_l` / `l_100mi`) in Settings. Popular currencies (`RUB`, `USD`, `EUR`, `GBP`, `CNY`, `INR`, `KZT`, `BYN`, `TRY`, `AED`, `CHF`, `CAD`, `AUD`, `PLN`, `BRL`) are selectable in Settings, Analytics, Bank CSV import and forms while preserving per-vehicle currency overrides and custom three-letter ISO codes.
- Vehicle creation defaults to the global currency when omitted; event, reminder, budget, recurring-cost and body-damage creation default to the selected vehicle's currency and then the global default currency instead of hardcoded `RUB`.
- Garage, vehicle profile, fuel summary and analytics aggregate and display amounts in the active vehicle or selected currency, and fuel volume totals include fill-ups regardless of currency.
- Fuel cycle and analytics consumption calculations honor the configured distance, volume and consumption units (including UK combinations such as miles + litres + `L/100 km` or `mpg (UK)`), without altering stored raw odometer integers or exact minor-unit money values.

## Compatibility
Schema remains 007 and released migrations/fingerprints are immutable. Existing user settings, records, operation IDs and offline queues remain fully compatible. No currency conversion is performed across different currencies.
