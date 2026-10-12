# Testing MASHINA

English · [Russian](testing-release.ru.md) · [Roadmap](roadmap.md) · [Updates](updating.md)

Use a separate installation with fictional information. Select **English** before
setup/sign-in, or under **Settings → App language**. Your preference synchronizes
after offline changes; user records, units and currencies are unchanged. Export
and notification localization remain planned.

## macOS Terminal

Install Git and Docker Desktop for your Mac architecture. Start Docker Desktop
and wait for the engine. Python/Node are not needed for container use.

```sh
docker version
docker compose version
git clone https://github.com/kosavan/mashina.git mashina-test
cd mashina-test
cp .env.example .env
mkdir -p data
docker compose build
docker compose run --rm --no-deps --user 0:0 --cap-add CHOWN --entrypoint sh mashina -c 'chown 10001:10001 /app/data'
docker compose up -d
docker compose ps
```

The ownership command prepares only this data volume; the app runs without root.
Open **http://localhost:8000**, then **Explore the demo garage**. For a permanent
test garage, create an administrator once:

```sh
docker compose exec mashina /app/.venv/bin/python -m backend.cli create-admin
```

Enter a username of 3–64 characters and a password of at least 12 characters;
password input is hidden. First build requires internet. Physical macOS/Apple
Silicon Docker deployment has not been independently verified.

## Windows PowerShell

Install Git for Windows and Docker Desktop with WSL 2 and **Linux containers**.
Start Docker Desktop. Use ordinary PowerShell and a local directory outside
OneDrive, network drives and synchronized folders.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\mashina-testing" | Out-Null
Set-Location "$env:USERPROFILE\mashina-testing"
docker version
docker compose version
git --version
git clone https://github.com/kosavan/mashina.git mashina-test
Set-Location mashina-test
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data | Out-Null
docker compose build
docker compose run --rm --no-deps --user 0:0 --cap-add CHOWN --entrypoint sh mashina -c 'chown 10001:10001 /app/data'
docker compose up -d
docker compose ps
```

Stop if a command fails. `chown` runs inside Linux, not Windows. Allow the bind
mount in Docker Desktop if requested. Open **http://localhost:8000** and explore
the demo or create an administrator with the same command as above. Physical
Windows Docker Desktop deployment is not a CI claim.

## Linux, releases and server access

See [self-hosting](self-hosting.md). These clone commands use current `main`,
including fixes newer than release tags. To pin a release, choose an existing
tag from [Releases](https://github.com/kosavan/mashina/releases) and run
`git switch --detach TAG` before building, replacing `TAG` with its exact name.
Read the [update guide](updating.md) before changing an existing installation.

Use your server's configured HTTPS URL or an SSH tunnel:

```sh
ssh -N -L 8000:127.0.0.1:8000 USER@SERVER
```

Keep the terminal open; Ctrl+C closes the tunnel. Its URL must match
`MASHINA_ORIGIN`. On a phone, localhost means the phone, not your server.
For iPhone PWA installation use HTTPS and Safari → Share → Add to Home Screen.

## Manage the test instance

From the installation directory, on either desktop OS:

```sh
docker compose ps
docker compose logs --tail=100 mashina
docker compose stop
docker compose start
```

`docker compose down` removes containers but retains `./data`; preserve that
folder and private `.env`. Do not repeat setup on an existing database. If port
8000 is busy, set both `MASHINA_PORT=8001` and
`MASHINA_ORIGIN=http://localhost:8001` in `.env`, recreate the container and use
that exact URL. Localhost and 127.0.0.1 are distinct origins.

## Acceptance walkthrough

1. Create two cars, purchase odometer 10000, with fictional photos. Reload each
   profile; check switching, empty states and both themes.
2. Save 1234.56 RUB, edit to 1000, delete and undo. History/analytics must reflect
   exactly one expense and each correction.
3. Fuel: 30 L × 60 RUB/L = 1800 RUB. One full tank cannot measure consumption.
   On a separate car record a full tank at 10000 km, partial 10 L at 10200 km,
   full 30 L at 10500 km: 8 L/100 km. Exclude the initial tank's litres.
4. Service: 3 × 100.10 RUB minus 0.20, plus 700 RUB minus 0.09 = 1000.01 RUB.
   Attach a synthetic PDF; find part numbers and confirm one financial entry.
5. Historical mileage must not reduce current mileage. Incorrect chronology
   requires deliberate confirmation. Repeating reminders advance using actual
   completion facts; estimated costs do not become expenses.
6. Compare currencies/periods/cars. Purchase and sale remain separate; missing
   mileage produces an explanation rather than fabricated zero values.
7. Load online, choose DevTools → Network → Offline, create a fuel/expense/service
   record, reload, reconnect and sync. Exactly one server entry must remain.
8. Create a driver and verify limited access/private documents/revocation in
   another browser profile. Test tires, budgets, CSV and sale PDF disclosure.
9. Restore a full ZIP into a separate instance. Check cars, exact totals, photos
   and PDFs. Restored sessions/keys are invalidated and notifications paused.

## Import and OCR

**Maintenance → Import → Review statement** accepts a mapped synthetic CSV:

```csv
date;amount;description;id;currency
2026-10-01;-1800.00;Test fill-up;test-fuel-1;RUB
2026-10-02;-1000.01;Test service;test-service-1;RUB
```

Choose semicolon, ISO dates and negative expenses. Link existing entries instead
of duplicating them; reimport the same stable IDs. [Bank import](bank-import.md).

Choose **Read a photo or PDF** in a form. Inspect/edit recognition, tick verified
fields and apply to the draft; only normal Save creates an entry. Test cancel,
optional attachment and manual offline fallback. Full tank is human-confirmed.
[OCR limits](local-ocr.md). Optional API keys require explicit enablement and
scope; test revocation without publishing secrets. [API/MCP](machine-access.md).

## Automated checks and limits

See [development tests](development.md). CI covers backend invariants, real
native OCR, migrations, browser/offline flows and the production container.
Physical iPhone installation, arm64 hardware and actual Push/Telegram delivery
still require device-level validation. The [roadmap](roadmap.md) distinguishes
shipped features, improvements and research.
