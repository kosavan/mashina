# Install the pre-built Docker image

[Russian](container-image.ru.md) · [Install without Docker](standalone.md)

MASHINA is distributed through GitHub Container Registry for `linux/amd64` and `linux/arm64`. Install Docker Engine with Compose on Linux or Docker Desktop with Linux containers on macOS or Windows. Use a specific published release version.

1. Open the [release](https://github.com/kosavan/mashina/releases/tag/v1.15.0) and save `compose.registry.yml` into a dedicated installation directory. Put the release’s [.env.example](https://github.com/kosavan/mashina/blob/v1.15.0/.env.example) there as `.env` if you want to customize settings. Create `.env` if it does not exist, and add `MASHINA_IMAGE=ghcr.io/kosavan/mashina:1.15.0`.
2. Create `data` alongside the Compose file. On Docker Desktop, use a directory outside synchronized folders or network drives. The `chown` command below prepares the new data mount for the non-root service.
3. From that directory, run:

   ```sh
   docker compose -f compose.registry.yml pull
   docker compose -f compose.registry.yml run --rm --no-deps --user 0:0 --cap-add CHOWN --entrypoint sh mashina -c 'chown 10001:10001 /app/data'
   docker compose -f compose.registry.yml up -d --no-build
   docker compose -f compose.registry.yml exec mashina /app/.venv/bin/python -m backend.cli create-admin
   ```

Open `http://localhost:8000` and sign in. Open `/api/v1/health` on the same address to verify the version and schema. Compose restarts the service in the background whenever the Docker engine is running. On a desktop, configure Docker Desktop to start at sign-in if you want automatic startup. For remote access, follow the [HTTPS instructions](self-hosting.md).

## Update and rollback

1. Synchronize all devices. Follow the [backup procedure](updating.md) to stop the current service, create a complete backup with the current runtime and retain the current image. Copy the backup and old `.env` to a safe location. Remember the Compose project name (including `-p` or `COMPOSE_PROJECT_NAME` if used).
2. Keep using the same project, directory, `./data` mount and browser origin. Place the new `compose.registry.yml` beside the old installation’s Compose file and set `MASHINA_IMAGE` in `.env` to the new version. Run the `pull` and `up` commands above. Use the existing account.
3. Check `/api/v1/health`, sign in and verify records and attachments. Reopen each browser/PWA online and verify any pending entries sync.
4. For rollback, stop the new service and retain a separate backup of any new entries. Restore the matching pre-update archive using the previous image and the [rollback procedure](updating.md). Use the old Compose file for a previous source-built installation, or point the previous registry Compose file’s `MASHINA_IMAGE` to the retained previous image. Start that version using the same project and data mount.
