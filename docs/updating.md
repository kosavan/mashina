# Safely update MASHINA

English · [Russian](updating.ru.md) · [Deutsch](updating.de.md) · [Roadmap](roadmap.md)

The public product website is a separate static GitHub Pages deployment; see
[search discovery](discoverability.md). It does not change the app image, schema,
data or offline queues. Before replacing a published site, retain its deployed
commit SHA. Verify the page, screenshot, canonical and sitemap after deployment.
For a site rollback, revert the site source to the previously deployed version
and publish only after CI passes for that exact source. App rollback still
requires the matching image and complete data backup described below.

Preserve `./data`, private `.env` and the previous image. Never reinstall, rerun
account setup or replace `.env` with its example during an update. Use an existing
verified release tag. Check every command and stop on errors. Never run two app
versions or an optional notification dispatcher against the same database.

## Release 1.9.0: OCR, output languages, streaming archives and vehicle suggestions

Target tag: `v1.9.0` after publication; do not deploy an unverified tag. Read the [feature guide and limits](ocr-results-archives.md). There is no schema change from 007 and no new required dependency or configuration. Update frontend and server together: older servers do not support the new streaming-restore endpoint. Existing API payloads, machine CSV/JSON, IDs, exact amounts and offline queues remain compatible.

Before updating, synchronize devices, stop the app and optional notification dispatcher, retain the previous image and a complete verified copy of `data` (including uploads), and follow the backup commands below. Creation, upgrade snapshots and restoration now use disk-backed ZIP64 rather than retaining the whole archive in RAM. Provide data-volume capacity for the incoming archive, expanded restored data, current-garage recovery ZIP and a SQLite snapshot, in addition to live data and retained archives. New archives are limited to 20 GiB compressed/expanded and 100,000 entries. Large browser restores stage on the data volume; reverse-proxy size limits and timeouts may need an explicit owner configuration change. CLI is preferable for very large or slow transfers.

After startup, verify an existing vehicle and original attachment; manually read a fictional receipt and tax/discount invoice, review a conflicting value, export a RU/EN/DE PDF and readable CSV, and test the make/model/engine manual fallback. Verify backup and restore on a separate disposable data volume using the matching image before trusting the new backup. For rollback, stop the new app/dispatcher and restore the matching pre-update data copy with the previous image; do not clear browser storage. An older image cannot restore an archive beyond its previous 200 MiB limit. Keep the pre-update backup or stopped data copy and previous image together. Restored sessions are invalidated, notification channels are paused and machine credentials revoked as before.


## Release 1.8.1: lighter vehicle profile photos

Target tag: `v1.8.1`, after publication. Profiles now use the existing private WebP
card preview, including for previously uploaded photos. Original files, downloads,
report images, IDs, exact amounts and offline queues are preserved. There is no
schema/API/configuration/dependency change from 1.8.0. Follow the complete backup,
image replacement, verification and matching rollback below. After synchronizing,
reopen the PWA online; do not clear browser storage or reinstall it. Verify an
existing large photo in the profile and its original download. First use can build
the rebuildable preview cache; private images still require a server connection.

## Release 1.8.0: preserve existing installations

Target tag: `v1.8.0`, after publication in Releases. Release 1.8.0 adds safe-area-aware installed-PWA headers, private card previews, five more UI languages and local OCR crop/rotation, up to three selected PDF pages and reviewed simple line items. No schema change from 1.6/1.7 (007), dependency or required configuration change. Update the server and frontend together: old servers reject new language/OCR options. Original photos, IDs, hashes, exact amounts, settings and offline queues are preserved. Preview files in data/previews are rebuildable caches and are excluded from full operational backups. Existing photos receive previews on their first authorized card request. Original downloads and report photos remain unchanged.

Follow every backup/build/verification/rollback step below. Synchronize all devices before updating; never clear pending browser data. Verify the menu/header in the installed PWA, existing covers and original downloads, all eight language choices and one manual/offline record. Test OCR with a fictional source; applying suggestions changes a draft only. Keep the stopped data copy and previous image together for rollback. If updating from older schemas, the intervening migrations retain a complete recovery snapshot first.

## Release 1.7.0: German interface

Target tag: `v1.7.0` (use only after it appears in Releases). Follow all backup, build, verification and rollback steps below, keeping the existing data mount and private `.env`. Select **Deutsch** before sign-in/setup or in **Settings → App language** after updating. Confirm the language persists after reload, then check existing records and offline synchronization. Do not clear browser storage with pending changes. Close and reopen the PWA after synchronizing if the old app shell remains. [German walkthrough](updating.de.md) · [Language scope](languages.md).

No schema/config/dependency change from 1.6.0 (schema 007). Upgrading an older release still performs its required migrations and recovery snapshot. Both server and frontend must be updated together: old servers reject `de` preferences. For rollback restore the matching pre-update data and image; an older frontend does not support the saved German preference.

## Release 1.6.0: body damage schema

This release adds revision 007 without changing released migrations. First startup
upgrades schemas 001-006 after retaining a complete recovery ZIP. Existing records,
files, IDs, settings and offline operations are preserved. Verify the new Body and
damage section in a vehicle profile and your previous expenses/documents after
updating. Keep the pre-upgrade ZIP and cold copy: images from 1.5.1 and earlier
cannot open schema 007. Roll back the previous image **and** its pre-upgrade data
using the procedure below; never relabel or delete the schema version.

## 1. Synchronize, stop and back up

Read the target [release notes](https://github.com/kosavan/mashina/releases).
Synchronize pending entries on every device and resolve conflicts while online.
Download a full ZIP in Settings and copy it to another physical disk.
From the existing installation directory, record the previous revision/image ID:

```sh
git status --short
git describe --tags --always
docker compose images -q mashina
```

Pause any separately configured notification timer. Stop the app before CLI
backup: the CLI is another process, so database/file writers must be quiescent.

```sh
docker compose stop mashina
docker compose run --rm --no-deps mashina /app/.venv/bin/python -m backend.cli backup --backup-dir /app/data/backups --keep 7
docker image tag PREVIOUS_IMAGE_ID mashina:before-update
```

Replace `PREVIOUS_IMAGE_ID` with the recorded ID. Save the printed ZIP filename,
copy it off-disk, and keep `.env` privately. Linux may need sudo to read UID 10001
data. Do not proceed on backup failure. Releases through 1.8.1 limit compressed and
expanded restore archives to 200 MiB; 1.9 accepts up to 20 GiB through streaming
restore or CLI. Verify restorability with the matching image before upgrading.

Also keep an untouched **cold directory copy** for rollback after failed migration.
The destination below must not already exist; choose a new name if needed.
While app/timers remain stopped, Linux/macOS:

```sh
sudo cp -a ./data ../mashina-data-before-update
cp .env ../mashina-env-before-update
```

Windows PowerShell (confirm the destination is unused first):

```powershell
Test-Path ../mashina-data-before-update
Copy-Item -LiteralPath ./data -Destination ../mashina-data-before-update -Recurse
Copy-Item -LiteralPath .env -Destination ../mashina-env-before-update
```

Copying a stopped directory preserves DB/WAL/files together. Keep it private;
an additional off-disk copy protects against disk failure. Rehearse a restore in
a separate test instance before a schema-changing update.

## 2. Select and build

Replace `TARGET_TAG` with a real published tag. These commands work in Linux/macOS
Terminal and Windows PowerShell. Review tracked local changes first; do not use
forced checkout/reset. Preserve the original data mount/environment.

```sh
git fetch --tags origin
git switch --detach TARGET_TAG
docker compose build --pull
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 mashina
```

Stop on build/startup failure. Merge only desired new optional settings from
`.env.example`; no new administrator or ownership reset is needed.
Linux/macOS health: `curl --fail http://localhost:8000/api/v1/health`.
Windows: `Invoke-RestMethod http://localhost:8000/api/v1/health`.
Use your configured port/origin. Do not publish private logs.

## 3. Verify

Check all cars/settings, mileage, exact totals, historical entries, photos and a
PDF. Save/edit/delete a fictional entry and test one device's offline sync without
duplicates. Reopen the PWA online to install its new worker, then test offline.
Do not clear storage containing pending entries. Resume optional timers after checks.

Real Alembic paths 001–007 are tested for preservation of files, settings, stable
IDs and receipts. Shipped migrations stay immutable. Unknown/newer or unversioned
existing databases are refused, not reset. Before an installed schema changes,
a private full snapshot is retained in `data/upgrades/`; unchanged-schema restarts
create none. Snapshots are not pruned automatically and are not off-disk backups.
Migration errors stop startup; do not force schema markers or remove WAL files.

## Rollback after an unsuccessful update

Restore **the pre-update data and previous image together**. Downgrading code alone
after a schema change is unsafe. New changes after the snapshot will be absent.
Stop the app and timers. Keep the failed directory; the names below must be unused.
Linux/macOS:

```sh
docker compose stop mashina
sudo mv ./data ./data-failed-update
sudo cp -a ../mashina-data-before-update ./data
cp ../mashina-env-before-update .env
git switch --detach PREVIOUS_REVISION
```

Windows PowerShell:

```powershell
docker compose stop mashina
Move-Item -LiteralPath ./data -Destination ./data-failed-update
Copy-Item -LiteralPath ../mashina-data-before-update -Destination ./data -Recurse
Copy-Item -LiteralPath ../mashina-env-before-update -Destination .env
git switch --detach PREVIOUS_REVISION
```

Replace `PREVIOUS_REVISION` with the recorded tag/commit. Preserve all failed data
until recovery is checked. Create private `compose.rollback.yml`:

```yaml
services:
  mashina:
    image: mashina:before-update
```

Run the saved image without building, using the restored directory:

```sh
docker compose -f docker-compose.yml -f compose.rollback.yml up -d --no-build
```

Repeat health/data checks. A cold rollback also restores old sessions/keys: revoke
them deliberately if compromise is suspected. Alternatively, with a healthy current
schema, restore a validated ZIP while stopped (replace `ARCHIVE.zip`):

```sh
docker compose run --rm --no-deps mashina /app/.venv/bin/python -m backend.cli restore --file /app/data/backups/ARCHIVE.zip
```

ZIP restoration invalidates sessions/API keys and pauses notifications; sign in
again and reissue integrations. CLI startup checks/migrates the target database;
if a failed migration makes it unopenable, use the cold rollback above. Old
releases with the read-only restore bug also require the cold-copy path.
Keep `.env`, rollback files and archives out of Git. Disk failure/power loss and
unsupported manual edits require recovery procedures, not forced downgrades.

## Private HTTPS certificates on iPhone

A private installation can use an owner-controlled root CA and a separate server
certificate. The server certificate needs the actual hostnames/IPs in SAN,
`serverAuth` extended key usage, SHA-256 signatures and a supported validity period.
Keep the CA private key outside the gateway's mounted TLS directory; never put
private keys, personal certificates or installation profiles in Git.

Install the public certificate-only profile on the iPhone, then explicitly enable
the named CA in **Settings → General → About → Certificate Trust Settings**.
Installation alone does not enable HTTPS trust. See
[Apple's certificate trust instructions](https://support.apple.com/en-us/102390).
Keep using the existing PWA address and preserve browser storage/offline queues.
This changes TLS trust, not the account password or application data.

Before replacing TLS files, preserve the previous certificate/key and gateway
configuration in a private server backup. Verify both private and public addresses
against the new CA, run `nginx -t`, reload the gateway and repeat health checks with
certificate verification enabled. Record certificate expiry and renew the server
certificate with the same CA before expiry; devices retain their installed root.
For a TLS-only rollback, restore matching TLS files/configuration and reload the
gateway. Keep the current database/files; restoring old application data is not
part of a certificate rollback.
