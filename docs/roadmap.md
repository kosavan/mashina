# MASHINA roadmap

English · [Russian](roadmap.ru.md) · [Update guide](updating.md)

Last reviewed: **2026-10-12**. Shipped means implemented and tested; hardware
validation and future work are separate. Dates are not delivery promises.

## Shipped feature map

| Area | Available | Limits / evidence |
|---|---|---|
| Body condition 1.6 | Five-view panel/point map, before/after images, repair statuses/history, service links | [Guide](body-damage.md); offline text/markers, online photo upload |
| Garage | Multiple cars, profiles/photos, ownership, archive/sale, manual VIN | Profile/history tests; automatic VIN lookup is planned |
| Daily records | Exact expenses, service items/parts, fuel, mileage, notes | Financial invariants, edit/delete/replay tests |
| Analytics | Period/category/car filters, full-to-full fuel cycles | Missing measurements stay unknown; purchase/sale separate |
| History / files | Search, filters, private images/PDF, JSON/CSV, full archive | Authorization and restore tests |
| Reminders | Dates/mileage, repeats, confirmed completion, estimates | Forecasts do not create expenses/readings |
| Tires | Dedicated section, mounting, DOT, tread measurements, thresholds | No claim of measured technical condition |
| PWA / offline | Durable queue, reload/replay safety, offline modules | Physical iPhone validation remains open |
| Ownership tools | Sharing, budgets, regular costs, reviewed CSV, sale PDF | Explicit scope and disclosure |
| OCR 1.5 | Receipts, invoices, dashboard photos, arbitrary screenshots | Local text OCR, selected PDF page, human review |
| Optional integrations | Scoped REST, read-only MCP, notifications, opt-in map | Device/external delivery checks remain open |
| UI | English/Russian setup/settings, themes, isolated demo, localized screenshots | PDF/export/notification localization is incomplete |

## Maintenance 1.5.1

Maintenance changes and their automated coverage; see Releases/Actions for verification:

- Preserve existing preferences on partial settings updates.
- Repair restore staging in read-only containers and recover failed file swaps.
- Test real upgrades of every schema 001–006; preserve files, IDs and receipts.
- Refuse unknown/newer schemas; snapshot before changing an installed schema.
- Separate English/Russian guides and document backup, update and rollback.
- Complete regression, production-container restore and release audit.
- Preserve reconnect triggers that overlap an unfinished offline synchronization.
- Serve bundled fonts as local files compatible with the existing CSP.

## Prioritized plan

| Priority | Planned work | Acceptance boundary |
|---|---|---|
| Next | More local OCR | Crop/rotate, multi-page invoices, reviewed item tables/part numbers, evaluated seven-segment reading |
| Next | Output localization | English/Russian PDF/export labels and notifications, unchanged user content |
| Ongoing | Safe upgrades | Every release tests supported schemas, restoration and offline-client compatibility |
| Planned | Larger backup archives | Bounded-memory streaming and verified restore beyond the current 200 MiB limit |
| Ongoing | Device/accessibility/performance | Physical iPhone, arm64, actual notifications and low-power benchmarks |
| Later | Natural-language search | Local processing, permissions, measured resource budget |
| Later | Expense bot and OBD-II | Optional owner-configured components, confirmed writes |
| Later | Passkeys and more languages | Preserve existing login/data |
| Research | VIN / compatible parts | Licensed sources and proven fitment; details below |

## Available in 1.6: interactive body damage map

An optional visual condition record in each vehicle profile, designed for mobile use.
Available in vehicle profiles. See the [usage and limits guide](body-damage.md).

- Select a body panel or place a marker on front, rear, left, right and top views;
  support multiple damage records on the same panel. Use a contemporary, curved generic
  vehicle outline rather than requiring model-specific illustrations.
- Record scratches, dents, paint chips, corrosion, cracks and other exterior damage,
  with date, optional mileage, notes, photos and owner-assessed severity.
- Track status: observed, needs repair, planned, repaired or monitoring. Use labels
  and icons as well as colors; provide an accessible list alongside the diagram.
- Link a repair to an existing maintenance event, service/location, documents and
  before/after photos. Keep estimates separate from actual expenses; linking a
  record must never count an expense twice or create a payment automatically.
- Preserve the damage and repair history after completion, vehicle sale or archive;
  distinguish current unresolved issues from past repairs.
- Store records and images locally with vehicle access controls, complete export,
  backup/restore and compatibility-preserving migrations. Support offline text/marker
  edits with idempotent sync; explain that selected new photo files require an online upload and are not durably queued.

Acceptance: on a 360 px screen, mark two separate issues on one panel, attach photos,
filter unresolved issues, link one confirmed repair and retain its original history.
Automated checks cover authorization, offline replay without duplicates,
financial linkage, backup/restore and upgrades preserving existing garages.

## Roadmap maintenance

Accepted requests and changed scope MUST update both language versions. Move work
to shipped only with code/spec/test evidence and a verified release. Keep partial
work's limits visible. The engineering constitution makes this a review requirement.

Release **1.5.0** adds the first fully local text OCR slice. Core garage, exact expenses/fuel/service, documents,
reminders, analytics, offline/PWA, backups, sharing, tires, budgets, reviewed CSV,
sale PDF, optional notifications/API/read-only MCP and Russian/English UI are shipped.

## Available in 1.5: fully local text OCR and reviewed entry

- Fuel receipts: read text and propose explicitly printed date, total, litres and unit price.
- Workshop invoices, bills and work orders: read selected PDF pages/photos, propose total
  and preserve the text for reviewing work and parts. Structured multi-page item tables follow.
- Dashboard photographs: propose labelled odometer candidates while keeping trip meters,
  range, miles and uncertain digits distinct. Available during fuel and odometer entry.
- General screenshots: banking/vehicle apps and arbitrary images; extract text and let
  the owner choose and correct values. A bank payment alone does not prove a fuel purchase.
- All processing stays on the owner's server. No paid API, external OCR, telemetry,
  runtime cloud model download or document transfer to another service.
- Recognition produces a reviewable suggestion, never an automatic financial or mileage
  record. Missing/ambiguous values remain unknown; full tank always needs human input.
- Explicit application of selected fields, optional source attachment, existing exact
  validation, historical odometer warnings and idempotent saves remain mandatory.

First vertical slice: bounded on-demand local text OCR for images and a selected PDF page,
editable field review integrated into existing expense/fuel/service/odometer forms,
Russian/English UI, authorization/resource-limit tests and real-engine CI fixtures.
Universal layout recognition and reliable reading of every instrument display are not promised.

## Follow-up OCR improvements

Manual crop/rotation; multiple selected pages; structured workshop line items/part numbers;
seven-segment display evaluation; explicit per-field alternatives and better local parsing.
Optional local-only vision models may be evaluated later against CPU/RAM budgets; no cloud fallback.

## Remaining product work

1. Localize PDF/export content and notification payloads; then add more UI languages.
2. Natural-language history search, optional expense-entry Telegram bot and OBD-II component.
3. Passkeys and additional sign-in methods.
4. Continue device/accessibility/performance and backup/restore verification alongside every slice.

## Planned: VIN identification and compatible spare parts

Manual VIN entry already exists in the vehicle profile. Extend it with reviewed VIN
decoding and a searchable vehicle-specific parts catalogue:

- Propose vehicle specifications from the VIN; show the source and let the owner confirm
  changes. Preserve manually entered details and support vehicles with non-standard identifiers.
- Search OEM part numbers, manufacturer articles and documented equivalents; start with
  common service parts such as filters, plugs and brakes. Save confirmed parts to the car
  and reuse them in maintenance records and a personal shopping list.
- Check fitment against engine, transmission, production date, market and equipment codes
  where available. A VIN or similar-looking article alone is not proof of compatibility;
  incomplete matches must be marked as unverified.
- Research legally reusable open datasets and manufacturer catalogues before selecting
  an integration. Record licence, coverage, provenance and update date. Prefer local import,
  local search and owner-maintained entries, with no mandatory paid service.
- Any external lookup must be optional and explicitly initiated by the owner; do not send
  a stored VIN to a third party automatically. Core garage and saved parts remain usable offline.

Research starting points: [NHTSA vPIC](https://vpic.nhtsa.dot.gov/) provides basic VIN
decoding, not a replacement for a compatible-parts catalogue. Its market coverage and
local database resource requirements need evaluation. [TecDoc](https://www.tecalliance.net/solutions/tecdoc)
provides vehicle-to-part matching, but is a licensed commercial option, not an assumed
open database. A suitable comprehensive openly licensed parts source has not yet been
confirmed; this is a research milestone before committing to catalogue coverage.

Physical iPhone, macOS/arm64 Docker and real notification delivery still need device-level
validation. Owner testing does not block automated implementation and regression work.
Dates and future release numbers are intentionally not committed before validation.
