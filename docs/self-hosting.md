# Self-hosting

Linux requires Docker Engine and Compose. macOS and Windows use Docker Desktop with Linux containers; see the [separate Terminal and PowerShell walkthroughs](testing-release.md). Choose English, German, Russian, Simplified Chinese, Hindi, Spanish, Arabic or French before initial setup or sign-in, then change it under Settings. Russian is the default. The account preference is saved; local offline changes synchronize when connected. Switching language does not change currency, units or your records.

```sh
git clone https://github.com/kosavan/mashina.git
cd mashina
cp .env.example .env
mkdir -p data
sudo chown 10001:10001 data
docker compose up -d --build
docker compose exec mashina /app/.venv/bin/python -m backend.cli create-admin
```

Open `http://localhost:8000`. The last command creates an owner interactively without printing the password. For web setup instead, run the `bootstrap` command and privately read `data/.bootstrap-token`. Public registration is disabled.

The non-root container serves frontend and backend in one process. `./data` holds SQLite, uploaded files and recovery snapshots; preserve it across updates. For remote access use your HTTPS reverse proxy, set `MASHINA_ORIGIN` and `MASHINA_SECURE_COOKIES=1`; see [Caddy example](../Caddyfile.example). Do not expose plain HTTP publicly. iPhone installation uses Safari → Share → Add to Home Screen and requires HTTPS (localhost is the exception).

## Backup before updating

Use the [complete update and rollback guide](updating.md), including release
selection and retaining the previous image. Stop writers before a CLI backup.

```sh
docker compose stop mashina

docker compose run --rm --no-deps mashina /app/.venv/bin/python -m backend.cli backup --backup-dir /app/data/backups --keep 7
docker compose build --pull
docker compose up -d
```

Download the archive to a different physical disk. A backup beside SQLite does not protect against disk failure. ZIP contains a consistent SQLite backup-API snapshot, files and SHA-256 manifest. Configure retention with `--keep` or `MASHINA_BACKUP_KEEP`. Archives contain private history and password hashes; keep them private. No mandatory background scheduler is installed.

For a restore drill, use a separate data directory/instance. Stop the app and any optional notification timer before CLI restoration:

```sh
docker compose stop
docker compose run --rm --no-deps mashina /app/.venv/bin/python -m backend.cli restore --file /app/data/backups/mashina-YYYYMMDD-HHMMSS.zip
docker compose up -d
```

Restoration validates paths, sizes, hashes, schema and foreign keys; a recovery copy precedes replacement. Sessions are invalidated and notification delivery is paused after restore. Never copy only the live `.db` file while WAL is active. In 1.9, streamed web/CLI restore accepts up to 20 GiB compressed/expanded and 100,000 entries, with staging on the data volume; individual attachments remain limited to 20 MiB. Older images retain their 200 MiB restore bound. See [archive capacity and rollback](ocr-results-archives.md).

Settings also export related JSON/CSV and a full archive. Core data stay local. Optional notifications, machine API and maps need explicit owner/user actions; no external integration is required for ordinary record keeping.

[Release testing and known unfinished work](testing-release.md) · [Detailed Russian operations handbook](handbook.ru.md)
