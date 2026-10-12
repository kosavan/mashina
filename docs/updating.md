# Safely update MASHINA

English · [Russian](updating.ru.md) · [Roadmap](roadmap.md)

Preserve `./data`, private `.env` and the previous image. Never reinstall, rerun
account setup or replace `.env` with its example during an update. Use an existing
verified release tag. Check every command and stop on errors. Never run two app
versions or an optional notification dispatcher against the same database.

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
data. Do not proceed on backup failure. Restore currently limits compressed and
expanded archives to 200 MiB; verify restorability before upgrading a large garage.

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

Real Alembic paths 001–006 are tested for preservation of files, settings, stable
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
