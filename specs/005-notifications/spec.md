# MASHINA 1.1 — optional private notifications
**Branch** codex/mashina-notifications | **Date** 2026-10-12 | **Status** specified

## User stories and acceptance
### US1 — Deliberate device subscription (P1)
A signed-in owner enables Web Push on this device after an explicit button press.
1. Core application makes no outbound notification requests by default. Demo cannot subscribe or send.
2. Unsupported/denied browsers and missing server setup have useful explanations. iPhone instructions mention installing on Home Screen; feature detection governs availability.
3. Only own subscription IDs/labels/statuses are returned; endpoint/auth keys never appear in state, exports, logs or other accounts. Unsubscribe removes server binding and device registration; logout removes this device binding before ending session.
4. Push notification shows generic MASHINA text without vehicle names, VIN, plates, amounts, private descriptions or documents; same-origin click opens app. External browser service and lock-screen visibility are disclosed before consent.
### US2 — Explicit Telegram linking (P1)
The user gets a short-lived one-time code and sends it to the owner's configured bot in a private chat.
1. Optional CLI update reception verifies code/private chat; arbitrary browser-provided chat IDs never establish ownership. Tokens stay server-only; configured bot username is public.
2. Codes expire in 10 minutes, stored hashed, single use; user can disconnect. Demo cannot link. Telegram receives only generic reminder text; no actual external messages are sent during automated tests.
3. Without configuration, UI explains setup rather than offering a nonfunctional enable control.
### US3 — Reliable controlled dispatch (P1)
The server owner runs a bounded optional timer/CLI; application has no permanent polling service.
1. Only active accounts and current vehicle owners receive active, incomplete reminders for active vehicles. Confirmed odometer and existing date/km OR rules determine soon/overdue.
2. One delivery per recipient/channel/destination/reminder/deadline cycle/stage, independent of reminder title edits. Completion/rescheduling creates a new cycle. Repeated runs and concurrent dispatch do not duplicate accepted deliveries.
3. Record provider acceptance distinctly from device delivery/read. Network uncertainty or interrupted send never retries silently. Explicit user retry warns that a duplicate is possible.
4. 404/410 disables expired Push binding; 429 records retry time. Other errors are sanitized and visible. Recheck current permission/channel before sending; no transaction remains open during network request.
5. Dry-run has no network calls or persistent delivery changes and prints only aggregate counts. Real sends require explicit --send. Each run is capped at 50 sends / 60 seconds with bounded HTTP timeouts.
6. Backups retain VAPID identity and journal. Restore pauses channels and removes pending links; explicit local resume is required. Dispatch and restore share an interprocess lock; stop timers for CLI restore as documented.

## Requirements
- FR-001 Optional, disabled-by-default, per-user/private channels and generic payload.
- FR-002 Locally generated persistent VAPID identity, bounded authenticated subscription APIs and same-origin notification click.
- FR-003 SSRF-safe HTTPS Push transport: server provider allowlist, valid P-256/auth keys, global DNS answers, pinned verified address/SNI, no redirects or proxies, bounded response/time.
- FR-004 Verified one-time private Telegram linking and fixed API origin; secret-safe errors.
- FR-005 Durable deduplication, bounded dispatch, no silent retry of uncertain acceptance; explicit retry and expired cleanup.
- FR-006 Migration/backup/restore compatibility and paused restoration, no lost vehicle history.
- FR-007 Finished Russian mobile settings with setup/loading/error/support/consent/history states; no polling.

## Success criteria
- SC-001 Tests prove no calls when disabled/dry-run/demo; authorization and secret sentinels.
- SC-002 Two dispatcher claims cannot send one delivery twice; unchanged runs/title edits do not resend; cycle/stage changes do.
- SC-003 Fixed-clock due rules, expiry/429/timeout/crash/revoke and explicit retry behavior verified with fake transports.
- SC-004 SSRF/private/mixed DNS/redirect/bad key cases denied before outbound request.
- SC-005 Backup roundtrip preserves identity/history but sending remains paused; 001/002/003 migrate with channels off.
- SC-006 Headless browser verifies unsupported/setup/consent/disconnect and service-worker user-visible generic notification; physical iPhone/provider delivery limits documented honestly.

## Scope and assumptions
No notification guarantees, read receipts, rich private payloads, scheduled prediction, group Telegram chats, constant bot polling or inbound expense bot in this slice. Standard Apple/Mozilla/Google Push providers supported; additional origins require server-side code review. External integrations remain optional. System timer is installed by owner, not on the development workstation during this task. UTC dispatch timestamps, server local calendar date for existing reminder rules.
