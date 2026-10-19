# VIN, registration and parts sources

English · [Russian](vehicle-source-research.ru.md) · [Roadmap](roadmap.md)

Initial investigation: **19 October 2026**. These are research findings, not shipped
integrations. No owner VIN, registration plate, garage data or credentials were sent.
No accounts, subscriptions or infrastructure were created.

## Sources and availability

| Source | Coverage and useful output | Access and restrictions | Verification |
|---|---|---|---|
| [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/Home/Index) | Basic make/model/year/engine attributes, mainly vehicles intended for US sale/import; other markets may be incomplete | Public API, no key in tested calls; traffic controls apply. Partial VINs supported | Official wildcard sample returned HTTP 200, BMW X3, 2011, 3.0 L, six cylinders, **error 6: incomplete VIN** |
| [RDW](https://data.overheid.nl/dataset/11441-open-data-rdw--gekentekende-voertuigen) | Netherlands registration dataset: make, trade name, inspection expiry and other registration attributes | Government catalogue specifies CC0; public queries worked without a key. Country-specific, not a global VIN decoder | Metadata and a query selecting three fields without the plate returned HTTP 200 |
| [DVLA Vehicle Enquiry](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html) | UK plate: make, year, engine capacity, fuel, tax/MOT status; documented response does not supply model or VIN | API key; **new registrations currently closed** during service upgrades | Documentation only; no credentials or live vehicle query |
| [DVSA MOT History](https://documentation.history.mot.api.gov.uk/) | UK inspection results, recorded mileage, failures and advisories; coverage depends on vehicle class/region/date | Application required; OAuth client credentials plus API key. Published limits: 500,000/day, 15 requests/s, burst 10 | Documentation only; no application submitted |
| [Auto.dev](https://www.auto.dev/pricing) | Claims global VIN attributes including engine/transmission; partial responses possible | Pricing advertises 1,000 free calls/month, but terms restrict free usage in production systems serving end users; caching/export rights also need clarification | Documentation only; claimed country coverage untested |
| [Avtocod B2B](https://b2bapi.avtocod.ru/docs/about/overview) | Russian vehicle reports by supported identifiers | Commercial authenticated service. Report generation debits the balance; reading an existing report is not a free new report | Documentation only; no paid requests |
| [TecDoc](https://www.tecalliance.net/solutions/tecdoc) | Vehicle identification and vehicle-to-part linkages | Commercial licensing; regional coverage and redistribution rights require a contract | Documentation only; no licence acquired |

The [DVSA government catalogue](https://findtransportdata.dft.gov.uk/dataset/mot-history-api)
labels the service free under the Open Government Licence, but its older metadata
does not describe current authentication. Reconfirm current terms before implementation;
use the [current authentication](https://documentation.history.mot.api.gov.uk/mot-history-api/authentication/)
and [rate-limit documentation](https://documentation.history.mot.api.gov.uk/mot-history-api/rate-limits/).

[Auto.dev terms](https://www.auto.dev/terms), including sections 4.2–4.4, limit data
redistribution/derivative databases and free production use. A free pricing allowance
does not establish permission for MASHINA exports, persistent archives or end-user use.
Do not make this the default source without resolving those rights.

For Russia, no stable, documented, publicly reusable free government VIN/plate API was
confirmed. The [official traffic police site](https://xn--80aebkobnwfcnsfk1e0h.xn--p1ai/) offers vehicle
checking, but a web form is not evidence of an API licence. Keep an owner-initiated
official-site link as a possible fallback; do not bypass CAPTCHA or build against
undocumented internal endpoints. [DaData vehicle cleaning](https://dadata.ru/api/clean/vehicle/)
normalizes supplied make/model names; it is not VIN decoding.

## Evidence and limits

The [public probe record](research/vehicle-api-probes-2026-10-19.json) contains three
successful requests and selected public results. The vPIC sample is deliberately
incomplete: an HTTP success cannot be treated as a fully identified vehicle. The RDW
probe proves public access to selected fields, not a tested plate lookup, full history
or engine variant match. Timings are individual observations, not latency guarantees.
Credentialed services, Russian coverage and exact equipment decoding remain untested.

[vPIC downloads](https://vpic.nhtsa.dot.gov/Downloads) currently offer SQL Server and
PostgreSQL databases, with stored decoding logic. They are not drop-in SQLite tables.
Do not add a database server to the low-power deployment for this research; first assess
licensing, updates, resource use and whether local decoding justifies extra infrastructure.

No comprehensive openly reusable OEM/analogue fitment source has been established.
VIN attributes and similar part numbers cannot prove fitment: engine, transmission,
production date, market and equipment may matter. Manual saved parts remain useful
without any catalogue subscription; uncertain matches must remain unverified.

## Proposed implementation order and gates

1. Build optional reviewed attribute suggestions, initially evaluating vPIC for US-market
   cars. Benchmark documented fixtures across markets before promising coverage. Preserve
   partial/ambiguous results and source errors; never invent an engine code or trim.
2. Evaluate RDW for Netherlands registrations. Evaluate DVSA only after owner-provided
   credentials and current terms are confirmed. DVLA onboarding is blocked externally.
   Russian services remain manual or optional licensed providers until rights and coverage
   are proven. Determine jurisdiction explicitly, independently of interface language.
3. Keep lookup disabled until an owner explicitly requests it and understands the external
   disclosure. Use the server to protect provider keys; redact identifiers from logs and
   errors. Bound timeouts, response sizes and retries; honour throttling without background
   polling. Never query all stored vehicles automatically.
4. Show source, retrieval time, coverage and uncertainty alongside each proposed field.
   Apply only owner-selected changes, preserving custom fields, identifiers, access rights
   and pending offline operations. Historical inspection mileage must not silently become
   a confirmed odometer reading. Lookup must not create expenses or service history.
5. Resolve retention, display, export and backup rights per source before caching results.
   Keep local garage, saved parts and manual entry functional offline. Test authorization,
   unavailable/partial responses, language fallback, retries and upgrade/restore behaviour.
6. Treat part matching as a separate milestone: select a licensed or demonstrably open
   dataset, prove fitment on documented examples and measure resource use before shipping.

This research changes no application behaviour, schema or server configuration.
