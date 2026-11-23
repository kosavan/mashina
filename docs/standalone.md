# Install MASHINA without Docker

[Russian version](standalone.ru.md)

MASHINA runs under your user account and opens in your browser at
`http://127.0.0.1:8000/`. The server keeps running when you close the browser.
The same archive works on Linux with systemd, Windows and macOS.

## Install

1. Install or update [uv](https://docs.astral.sh/uv/getting-started/installation/).
   From [GitHub Releases](https://github.com/kosavan/mashina/releases), download
   `mashina-standalone.zip` and extract it to a permanent folder you own.
2. Open a terminal in the extracted `mashina-<version>` folder.
   Run these commands as your normal user. First-time setup fetches Python 3.14
   and the locked dependencies. The archive includes the built web interface.

   ```text
   uv python install 3.14 --upgrade
   uv run --no-project --managed-python --python 3.14 tools/standalone.py prepare
   uv run --no-project --managed-python --python 3.14 tools/standalone.py admin create-admin
   uv run --no-project --managed-python --python 3.14 tools/standalone.py install
   ```

3. Open `http://127.0.0.1:8000/` and sign in. A healthy installation reports the
   data directory in the terminal. If port 8000 is occupied, add
   `--port 8001` to `install` and open `http://127.0.0.1:8001/`.
   If installation registers the service but reports a health check failure,
   use `status` and the logs below before retrying. To retry registration, run
   `uninstall` first.

The launcher checks for SQLite 3.51.3 or newer before it opens any database.
If your managed Python still has an older SQLite, upgrade uv and its Python
build before trying again. For receipt and PDF recognition, install Tesseract
with the appropriate language packs and Poppler separately. Put `tesseract`
and `pdftoppm` on your terminal's PATH before registering the service.

To install from a release tag instead of the ZIP, use Node.js 22 and run
`npm ci` and `npm run build` in `frontend/` before following the same steps.

## Background operation

The same launcher accepts `status`, `stop`, `start` and `uninstall` in place
of `install`.

| System | Automatic start | Logs |
| --- | --- | --- |
| Linux | The `mashina.service` systemd user service starts at sign-in. On a headless host, `loginctl enable-linger` for the service account enables startup at boot and survival after logout. | `journalctl --user -u mashina.service -n 100` |
| Windows | A Task Scheduler task named `MASHINA-<user SID>` starts at sign-in. | `server.log` in the data directory |
| macOS | The `io.github.kosavan.mashina` LaunchAgent starts at desktop sign-in. | `server.log` in the data directory |

The service needs the computer awake. Windows and macOS use your signed-in
session. For server access from another device, see the [Docker and HTTPS
guide](https://github.com/kosavan/mashina/blob/main/docs/self-hosting.md).

## Data, updates and rollback

- Linux uses `$XDG_DATA_HOME/mashina/data` or
  `~/.local/share/mashina/data`.
- Windows uses `%LOCALAPPDATA%\MASHINA\data`.
- macOS uses `~/Library/Application Support/MASHINA/data`.

You can set a custom absolute path with `--data-dir` on `install` and every
`admin` command. Keep it on a private local disk separate from the extracted
release. `uninstall` only removes the background service registration.

Before updating, stop the old service, run the backup command from the **old**
release folder and keep both the old folder and the resulting ZIP.

```text
uv run --no-project --managed-python --python 3.14 tools/standalone.py stop
uv run --no-project --managed-python --python 3.14 tools/standalone.py admin backup --backup-dir /path/to/private/backups
uv run --no-project --managed-python --python 3.14 tools/standalone.py uninstall
```

Substitute an absolute backup path, for example
`"C:\Users\you\MASHINA backups"` on Windows. Extract the new release to a
separate folder and run `install` with the same data directory and port.
Open the health endpoint at `/api/v1/health`, sign in and check existing vehicles
and attachments. The application preserves existing record and offline
operation IDs. Keep using the same browser address and profile to retain the
browser's pending operations.

For rollback, take a backup of any new work with the newer version while the
service is stopped, then uninstall its service. In the old release folder, use
the following command with an empty, private data directory. The archive must be
the one taken before the upgrade.

```text
uv run --no-project --managed-python --python 3.14 tools/standalone.py admin --data-dir /path/to/restored-data restore --file /path/to/pre-upgrade.zip
uv run --no-project --managed-python --python 3.14 tools/standalone.py install --data-dir /path/to/restored-data
```

Use the same restore command to migrate from Docker. Stop the old deployment
after creating the backup, restore that archive into an empty standalone data
directory, then verify the new installation before retiring the old one.

For maintenance or foreground use, run `prepare` once, then use the
installation Python to invoke `tools/standalone.py serve`. The installed
Python is `.cache/standalone/bin/python` on Linux and macOS, and
`.cache\standalone\Scripts\python.exe` on Windows. Stop the service first.
