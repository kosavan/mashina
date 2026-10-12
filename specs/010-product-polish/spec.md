# Feature: MASHINA product polish

## User Scenarios & Testing

### P1 — Trust the first impression
The owner sees a composed welcome screen rather than an accidentally square car photograph. From Fuel, “Графики и расход” opens fuel analytics for the selected vehicle, with completed-cycle consumption visible on desktop and mobile, including demo mode.

Acceptance: no horizontal overflow at 360 px; keyboard and touch activate the fuel link; vehicle and fuel filter carry into the report; no browser errors.

### P1 — Care for tires
The owner opens a dedicated Tires section, records manufacture week/year and dated tread measurements, edits a set and retains mounting history. Actual measurements and age guidance are distinguished from a mechanical inspection.

Acceptance: unknown age/depth remain unknown; invalid/future measurements are rejected; old sets remain editable; offline retry never duplicates a set; authorized roles and backup round-trip preserve the fields.

### P2 — Record and find services
The owner saves a service address and optional coordinates with an event. A styled location card works locally; loading an external map is an explicit action. Coordinates never imply the address was verified.

Acceptance: address survives edit/export/restore; coordinate pairs are validated; no map-provider request before user action; unsupported/offline location has a clear state.

### P2 — Faster fuel capture
The owner sees a concise suggested workflow for a receipt, bank payment or API-assisted draft and can use the existing fuel form without retyping repeated station/fuel values. No screenshot is claimed to contain liters, mileage or full-tank status when it does not.

Acceptance: defaults are vehicle-specific; any two price/volume/total values still compute the third; attachments remain local; confirmation precedes any external automation write.

### P2 — Discover the open-source product
The GitHub landing page defaults to concise English with a Russian choice, accurate feature claims, attractive local visuals, and links to desktop testing and deployment. Three tested logo concepts are presented before final identity selection; an editable Hyperframes infographic and static PNG are produced. The owner selected Apex M and requested green-only final artwork.

## Functional Requirements
- FR-001: Repair and regression-test welcome artwork and fuel navigation.
- FR-002: Expose Tires independently, with existing history plus optional age and measured tread history.
- FR-003: Give sourced, bounded tire guidance without asserting roadworthiness.
- FR-004: Store optional service address and coordinates with private events and show maps only on explicit request.
- FR-005: Improve fuel defaults and document evidence-assisted capture, keeping unknown values explicit.
- FR-006: Produce three original SVG identity concepts using the requested logo skill and respect its selection checkpoint.
- FR-007: Rewrite English/Russian GitHub presentation and prepare a locally rendered, reviewable Hyperframes infographic.
- FR-008: Preserve authorization, offline idempotency, money invariants and backup compatibility.

## Key Entities
TireSet gains optional manufacture code and dated measured tread depths. Event gains optional service location. Existing stable identifiers, ownership and financial semantics remain unchanged.

## Success Criteria
- SC-001: Fuel-to-chart regression passes for desktop and 390 px mobile demo.
- SC-002: Tire validation, history, permissions and restore tests pass for old and new payloads.
- SC-003: No private data or automatic third-party request is added to welcome, README or location UI.
- SC-004: Build, static checks and critical browser journeys pass; main entry remains below 180 KiB gzip.
- SC-005: Selected green identity assets and a verified Hyperframes infographic PNG exist; no unrequested MP4 export is required.

## Assumptions
“С учетом гола” means tire manufacture year/age. Recommendations concern care and replacement criteria rather than advertising specific tire models. Recognition is optional future work unless a complete confirmed workflow is implemented; the existing unfinished recognition branch is not advertised as released.

The GitHub infographic is a static image with editable motion source. A future requested MP4 export would require the selected tool's separate final-preview approval; no video export is part of this request.
