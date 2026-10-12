# MASHINA roadmap

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

Physical iPhone, macOS/arm64 Docker and real notification delivery still need device-level
validation. Owner testing does not block automated implementation and regression work.
Dates and future release numbers are intentionally not committed before validation.
