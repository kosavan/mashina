# Implementation Plan: local sale PDF
**Branch** codex/mashina-sale-report | **Date** 2026-10-11

## Summary
Owner-only on-demand PDF, assembled from an explicit allowlisted single-car snapshot. No migrations, public sharing links, external rendering service or worker. ReportLab Platypus with bundled OFL Manrope TTFs generates a light print layout with graphite/lime accents.

## Technical Context
Add runtime reportlab 4.x and dev pypdf for assertions. Fonts instantiated at development time from upstream Google Fonts Manrope variable TTF, license and source recorded; fontTools is a one-time tool, no production dependency. Register fonts once under a lock, render one report at a time with a nonblocking semaphore; return 429 busy rather than queue CPU work. Snapshot under Store.transaction, release DB lock before rendering. Existing owner policy, CSRF and session dependencies apply.
ReportOptions strict Pydantic: start/end optional dates, include_cover/include_costs/include_identifiers/include_descriptions default false. No user-provided file path/URL/template/markup. A typed ReportSnapshot contains allowlisted car attributes, work rows/parts and optional exact analytics totals grouped by currency. Plain text is XML-escaped before Paragraph; no vendor/notes/accounts/documents/filenames/URLs in report metadata or body. Descriptions are an explicit disclosure option because current work titles are free text. Photo is optional and not anonymized; UI warns it may reveal a plate/location.
Limit 500 service records and 5,000 selected total events; no silent truncation. Maximum 5 MiB PDF, 100 pages. Bound output text/positions through domain limits and safe wrapping; table rows permit splitting. Main document has cover summary, characteristics, ownership-mileage provenance, optional financial summary, then service chronology with structured parts. Dates and money use shared exact domain analytics; separate purchase/sale from running totals; mixed currencies never summed.
Snapshot reads one vehicle and its active selected events directly, never whole actor garage. Copy chosen local cover bytes under lock; permit only known image/jpeg or allowlisted built-in demo images. No reading arbitrary path from JSON. Invalid image yields controlled message. Render in memory, fixed download filename, no-store; no persistent generated artifact in runtime data.
Frontend lazy SaleReport.tsx custom preparation sheet on vehicle page, owner capability only. Four clear disclosure toggles, date range, included-fields summary, online requirement, progress/error and Blob download. No automatic email/Telegram/send/share.

## Constitution Check
PASS: exact shared finance, default private disclosure, owner gate, no new infrastructure, lazy frontend and measured output budgets. Test denial and hidden sentinel fields before implementation. Check rendering visually, not only PDF text extraction.

## Project Structure
backend/reports.py — typed options/snapshot/build and resource limits.
backend/assets/fonts/ — embedded fonts, OFL and reproducible provenance.
backend/app.py — protected PDF endpoint and throttle.
backend/tests/test_reports.py — privacy, authorization, finance, pagination and budgets.
frontend/src/SaleReport.tsx — lazy sheet; Views.tsx entry point.
frontend/tests/report.spec.ts — mobile preparation and real download.

## Complexity Tracking
No headless browser in production. No new tables/migrations. No PDF merge of untrusted uploads. Hard CPU timeout omitted: bounded event/text/page counts and one in-process generator are sufficient for this slice; error restores semaphore reliably.
