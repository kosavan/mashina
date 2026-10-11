# API
POST /api/v1/vehicles/{vehicle_id}/sale-report
Authenticated owner only, CSRF required. Strict JSON {start:"YYYY-MM-DD"|"",end:"YYYY-MM-DD"|"",include_cover:false,include_costs:false,include_identifiers:false,include_descriptions:false}.
200 application/pdf, attachment; filename=mashina-sale-report.pdf, no-store. 401 login required; 403 missing role/CSRF; 422 invalid date/options/history/output limits; 429 another report is being generated or rate limit reached. Drivers cannot obtain a report by knowing a vehicle UUID. Isolated demo allows an explicitly marked demonstration report.
