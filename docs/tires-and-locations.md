# Tires and service locations

English · [Russian](tires-and-locations.ru.md)

**Tires** is a dedicated section; existing sets/intervals also remain accessible
through Maintenance. DOT `3421` means week 34 of 2021: approximate manufacture
age, not an exact date or start of use. Record the oldest tire and check each
tire separately when ages differ.

Measurements retain dated minimum tread depth in tenths of a millimetre. Historical
measurements are editable; missing readings stay unknown. Closed mounting mileage
is not a health percentage. A personal warning threshold is not a legal limit.
Fields persist offline, in JSON and full backups without changing the SQL schema.

Reference [Michelin's guidance](https://www.michelinman.com/auto/auto-tips-and-advice/tire-buying-guide/when-do-i-need-new-tires)
and [marking explanations](https://www.michelinman.com/auto/auto-tips-and-advice/tires-101/tire-markings-explained).
Follow your vehicle/tire manufacturer's instructions. The UI does not measure
condition or automatically determine the correct season/weather.

## Service address cards

Advanced event fields include vendor, address and an optional latitude/longitude
pair. No device location collection or automatic geocoding occurs. A manually
entered point is owner-provided, not a verified service address.

Details show a local address card with copying. **Load map · OpenStreetMap**
explicitly loads an attributed iframe when coordinates exist. No provider request
is made before this action. Loading shares IP/coordinate area with OpenStreetMap;
availability is not guaranteed. Addresses remain local offline, maps are not
downloaded for offline use. CSP permits the exact OSM embed host, not arbitrary
external frames. [OSM policy](https://operations.osmfoundation.org/policies/tiles/).
