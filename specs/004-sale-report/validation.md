# Validation — local sale report

- Backend: 38 Pytest tests passed, including five report contracts. Ruff passed.
- Frontend: TypeScript, ESLint, Prettier and 9 Vitest tests passed; production build passed.
- Browser: 12/13 initially passed; new action caused horizontal overflow beneath access sheet at 360 px. Wrapped vehicle actions; targeted report/sharing 3/3 now pass. Complete rerun: 13/13 passed.
- Real demo PDF downloaded by headless mobile Chromium; explicit disclosure defaults, failure response and offline messages verified.
- PDF pages rendered with Poppler and inspected: three-page demo with cover/finance/history, long 200-work report 59 pages / 90,760 bytes, first history page and final page inspected. Cyrillic/Ё, ruble sign and long unbroken part text wrap without clipping. Removed orphan/empty page found in first rendering.
- 200-work generation test <3 seconds and output <5 MiB; 500-work overflow denied. Render semaphore busy/error cleanup checked.
- Privacy sentinel tests prove absent VIN/plate, free descriptions, costs, vendor, private notes and other vehicle data under defaults; XML text escaped, no PDF hyperlinks. Driver denied; no-store response.
- Ownership baseline regression: readings before acquisition cannot inflate period distance; snapshot matches shared analytics for four start boundaries.
- Linux CI/container result pending; no manual physical-iPhone verification claimed.

- Spec Kit convergence: 6 FR, 5 SC, 3 user stories and 12 governing principles checked; zero actionable gaps, no new convergence tasks. Source published in PR #3; merge remains gated on green Linux CI. No extension hooks configured.
