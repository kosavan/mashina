# Research and decisions
Primary sources:
- https://github.com/web-push-libs/pywebpush/blob/main/README.md — encryption/VAPID and custom request session; inspect installed transport before wrapping.
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ — direct user gesture and Home Screen support; feature detection, no delivery guarantees.
- https://core.telegram.org/bots/api#sendmessage and #responseparameters — fixed Bot API, private linking, retry_after.
- https://www.rfc-editor.org/rfc/rfc8030.html — accepted is not delivered; expiry/topic/TTL.
- https://www.rfc-editor.org/rfc/rfc8292.html — stable VAPID identity.
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html — strict origins, address validation/pinning and redirect denial.

Read-only delegated review highlighted that Store RLock does not protect another CLI process. Dispatcher modifies only DB, so SQLite backup API remains consistent. A shared filesystem advisory lock gates whole dispatcher and restore; restore cannot run while dispatch is active. CLI closes Store before releasing lock. Backups need not block dispatch or hold network transactions. Notification identity belongs in private DB rather than separate unbacked file; restore pauses outbound and requires local resume to prevent cloned-server duplicate sends. Never auto-retry unknown provider outcome. Telegram linkage requires one-time code, not an arbitrary supplied chat ID. Default payload carries no vehicle or work identity.


Dependency audit on 2026-10-12 found new Vitest/Tinypool advisories. Updated Vitest4.1.11 (supports Vite6/Node20+) and its locked dependencies; npm audit now0 findings. Added @types/node22 for the isolated service-worker test. CI/build remains Node22; documented local minimum20.19 follows current ESLint transitive engine requirement.
- https://github.com/advisories/GHSA-5gmw-xhrv-c9v3
- https://github.com/advisories/GHSA-85c8-ppgw-ccpr
- https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- https://vitest.dev/guide/migration/
