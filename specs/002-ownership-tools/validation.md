# Validation: ownership tools
Date: 2026-10-11.

- 26 pytest checks pass, including confirmed tire distances/overlap rejection,
  exact budget actuals, calendar-safe forecast, repeated CSV idempotency,
  atomic rollback of a conflicting import batch, restoration of revision 001
  into revision 002 and full recovery after a simulated migration failure.
- 7 Vitest checks pass; strict TypeScript, ESLint/Prettier and Ruff pass.
- 10 Playwright journeys pass. Added 360px tire history, budget/CSV review,
  repeated-file rejection and durable offline tire/budget drafts. The extended
  offline budget test also passes without a previously cached server report.
- Production entry bundle 126.5 KB gzip under the 180 KB budget; ownership tools
  load as a separate ~7 KB gzip chunk. Existing analytics remains lazy.
- Mobile tire screenshot visually reviewed; original product typography/cards maintained.
- Python audit: 34 installed packages, no known vulnerabilities; production npm
  audit reports zero known vulnerabilities. Audits are time-specific evidence.
- Physical iPhone acceptance and home-server timing remain explicitly manual,
  as documented for MVP. This slice has not yet been deployed to that server.

Convergence inventory: FR-001–FR-007, SC-001–SC-005, four user stories and the
existing constitution. No remaining implementation gaps in this slice.
The rest of release 1.1 (shared access, PDF, notifications) remains planned separately.
