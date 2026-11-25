# Mobile clients

English · [Russian](mobile-clients.ru.md)

## Android APK and iOS IPA

The mobile packages open MASHINA's existing interface in an app on your phone.
Each installation begins with an empty server setting. Enter your own server
address and use your existing MASHINA account. Android 8.0 and iOS/iPadOS 16
are the minimum versions.

1. Look for the mobile files and SHA-256 checksums in the
   [GitHub release](https://github.com/kosavan/mashina/releases). During
   development, the [mobile workflow runs](https://github.com/kosavan/mashina/actions/workflows/mobile.yml)
   carry the test builds under **Artifacts**.
2. On Android, open the signed APK and allow installation from the app you used
   to open it if Android asks. A preview APK uses a separate application ID and
   a temporary signature. Finish syncing any preview entries before replacing it.
3. On iPhone or iPad, sign the unsigned IPA using your signing identity and a
   provisioning profile that permits installation on your device. Use the same
   signing identity and bundle identifier for updates when supported by your
   signing tool. The package is for self-signing and sideloading.
4. Open MASHINA, select **Server**, and enter a local address such as
   `192.168.1.20:8000` or an HTTPS link such as
   `https://mashina.example.org`. An IP without a port uses port 8000.
   Use **Server** again to change the saved address. Sign in after the
   connection check succeeds.

### Reach the server from your phone

For a local HTTP connection, join the same Wi-Fi or a VPN with a route to the
server. The app accepts HTTP on private IPv4 addresses. Use HTTP only on a
trusted network because the connection is unencrypted. Use a certificate
trusted by your phone for HTTPS. For a private CA on Android, install the
owner's CA through **Settings → Security and privacy → Encryption and
credentials → Install a certificate → CA certificate**. On iPhone and iPad,
enable full trust for the installed CA and allow local network access if
prompted.

For a Docker installation, set `MASHINA_BIND` to the computer's LAN IP and
`MASHINA_ORIGIN` to the exact address entered on the phone, including its
port. For example, use `MASHINA_BIND=192.168.1.20` and
`MASHINA_ORIGIN=http://192.168.1.20:8000` with the default port.
Allow the port from your LAN in the host firewall. The standalone package
listens on loopback and can be reached from a phone through a reverse proxy
on that computer. See [standalone setup](standalone.md) and the
[update guide](updating.md).

If you use the PWA today, synchronize its pending changes before switching.
The installed app has its own web storage and sign-in session. Your synced
garage records are available from the same server. Use the PWA when you need
its established offline workflow. A cold offline launch and push notifications
in the packaged clients still need verification. On Android, open the server
in your browser to save reports generated as browser-only files.

## Build and release

- Android needs Java 17, Python 3.11 or newer and Android SDK platform 35 with
  build tools 35.0.1. Run `bash mobile/build-android.sh preview` on Linux.
  The script checks the signature, package ID and launcher of the APK.
- iOS needs macOS with Xcode and Python 3.11 or newer. Run
  `bash mobile/build-ios.sh`. The script checks the device architecture,
  bundle identifier and absence of a signature or provisioning profile.
- Both scripts write packages to `dist/mobile/`. For an Android release, use
  the same protected keystore for every update. The manual mobile workflow on
  `main` uses `MASHINA_ANDROID_KEYSTORE_BASE64`,
  `MASHINA_ANDROID_STORE_PASSWORD`, `MASHINA_ANDROID_KEY_ALIAS` and
  `MASHINA_ANDROID_KEY_PASSWORD` from repository secrets. It attaches both
  packages and checksums to an existing stable tag after both workflows pass on
  that exact source. Each platform keeps its own candidate artifact.
- Before distributing a release, install the release-signed APK and
  self-signed IPA on physical devices. Check connection rejection with an
  invalid certificate and with a redirected health endpoint. Sign in and open
  a permitted vehicle. Record a fill-up, reopen the app and confirm that the
  server shows it once. Check file upload and archive download, switch between
  two servers, reject an invalid replacement address, and update in place with
  the same signature and bundle identifier.

See [update and rollback](updating.md) for preserving server records and
pending entries.

## PWA

Open the server over HTTPS. On iPhone or iPad, use Safari's Share menu and
**Add to Home Screen**. On Android, use your browser's **Install app** or
**Add to Home screen** action. Sign in online before relying on offline access.
Edits created offline remain pending on that device until MASHINA synchronizes them.

## Planned direct API client

A future client with a bundled interface can reuse the
[API transport](../frontend/src/api.ts) and preserve the original mutation IDs,
versions and decimal strings. The planned milestone covers approved device
pairing, revocable credentials stored in Keychain or Android Keystore, a
transactional offline queue partitioned by origin and account, and receipt
capture. The [machine API](machine-access.md) serves scoped automation.
