# Validation Report — 017 Global Units & Currencies (MASHINA 1.11.0)

## Scope Verified
- **Global Default Currency (`#29`)**: `settings.currency` (default `"RUB"`) with per-vehicle currency override (`vehicle.currency`) and record-level inheritance (`record.currency || vehicle.currency || settings.currency || "RUB"`).
- **Popular World Currencies**: 15 popular two-decimal currencies (`RUB`, `USD`, `EUR`, `GBP`, `CNY`, `INR`, `KZT`, `BYN`, `TRY`, `AED`, `CHF`, `CAD`, `AUD`, `PLN`, `BRL`) with native symbols (`₽`, `$`, `€`, `£`, `¥`, `₹`, `₸`, `Br`, `₺`, `AED`, `CHF`, `CA$`, `A$`, `zł`, `R$`) across vehicle/record forms, analytics currency selector and bank CSV statement review, plus support for any custom 3-letter ISO currency code `[A-Z]{3}`.
- **Global Distance, Fuel Volume & Independent Fuel Consumption Units (`#30`)**: `settings.distance_unit` (`km` | `mi`), `settings.volume_unit` (`l` | `gal_us` | `gal_uk`) and `settings.consumption_unit` (`l_100km` | `mpg_uk` | `mpg_us` | `km_l` | `l_100mi`), supporting combinations such as UK miles (`mi`) with litres (`l`) and either `mpg (UK)` or `L / 100 km`.
- **8-Language Localization**: All new unit and currency strings translated across `ru`, `en`, `de`, `zh`, `hi`, `es`, `ar`, `fr` plus `backend/output_locales.json` (`RU`/`EN`/`DE` PDF and readable CSV).

## Automated Checks Executed
- `uv run ruff check backend`: passed (`All checks passed!`)
- `uv run pytest -q`: passed (`300 passed, 12 skipped`)
- `cd frontend && npm run check`: passed (`tsc -b && eslint src && prettier --check src`)
- `cd frontend && npm test`: passed (`12 test files, 37 tests passed`)
- `cd frontend && npm run build`: passed (`Entry gzip: 86.9 KB / 180 KB budget`)
- `cd frontend && npx playwright test` (E2E global currency & units, English and German localization): passed
- `uv run python tools/check_secrets.py && uv run python tools/check_docs.py && uv run python tools/check_migrations.py && python3 tools/build_site.py && python3 tools/check_site.py`: passed
