# Mobile clients

English · [Russian](mobile-clients.ru.md)

The current mobile app is the installable web app. Open your MASHINA server over
HTTPS. On iPhone or iPad, use Safari's Share menu and **Add to Home Screen**. On
Android, use your browser's **Install app** or **Add to Home screen** action.
Sign in online before relying on offline access. Edits created offline remain
pending on that device until MASHINA connects and synchronizes them.

## Shared foundation

- [The API client](../frontend/src/api.ts) handles JSON, multipart uploads and
  binary responses through one transport boundary. Requests keep the original
  mutation IDs, versions and decimal strings. Network failures and HTTP
  conflicts remain distinguishable so the offline queue can retry correctly.
- The web transport uses the existing same-origin session cookie and CSRF header.
  The [web queue](../frontend/src/offline.ts) keeps its existing IndexedDB
  database and user IDs. The [API contract tests](../frontend/src/api.test.ts)
  cover the session, mutation payloads, uploads, downloads and error handling.
- The [machine API](machine-access.md) serves scoped automation. Mobile sign-in
  requires its own account session, including access to shared vehicles and
  account-level revocation.

## First native milestone

Build an iOS and Android development client for one end-to-end journey.
Connect to the owner's server, sign in, read a permitted vehicle, record a
fill-up offline, reconnect, and verify that the server saves it once.

1. **Connection.** Accept a user-selected HTTPS server origin and check
   `/api/v1/health` before sign-in. Use platform TLS verification. Keep
   authentication bound to that origin and reject redirects that would send
   credentials to another origin. A shell with bundled UI should route API
   traffic through the app's native client for the configured server. Remote
   links should open in the system browser, outside the native API bridge.
2. **Device session.** Add a server-side pairing endpoint with a short-lived,
   one-time grant approved in the signed-in web app. Bind the resulting
   credential to the user and device, store it with Keychain on iOS or Android
   Keystore-backed storage, and show individual devices in account settings
   for revocation. Recheck the user's current garage permissions on every
   request, including retries.
3. **Offline storage.** Use private app storage with a transaction for both
   the visible local edit and its queued mutation. Partition data by server
   origin and account ID. Preserve an operation's UUID and expected version
   across reconnects, process restarts and app updates. Show conflicts and
   expired sessions without removing pending work. Keep demo data in its own
   store. Reuse the frontend transport and domain helpers if the native shell
   bundles the web UI.
4. **Native integration.** Add receipt capture and use the existing attachment
   flow. Start synchronization when the app opens or returns to the foreground.
   Add background work only after testing the operating system's delivery
   behavior. Server-side OCR continues to run on the owner's server.

Before store submission, verify the journey on physical iOS and Android
devices. Test untrusted certificates, a cross-origin redirect, denied and
revoked access, session expiry, a lost mutation response, switching between two
servers, restarting with pending changes, and updating the client while
offline. A successful store submission also needs
signing, privacy disclosures and a reviewable configuration. Consult
[Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
when planning the native feature set, including receipt capture.
