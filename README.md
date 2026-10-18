<p align="center">
  <img src="design/identity/exports/mashina-header.svg" width="320" alt="MASHINA" />
</p>

<p align="center">
  <strong>Your garage. Your history. Your server.</strong><br />
  A personal home for your cars, expenses, fuel and maintenance.
</p>

<p align="center">
  English · <a href="README.ru.md">Russian</a> · <a href="README.de.md">Deutsch</a> ·
  <a href="https://github.com/kosavan/mashina/releases">Releases</a> ·
  <a href="docs/roadmap.md">Roadmap</a> ·
  <a href="docs/updating.md">Update</a> ·
  <a href="docs/self-hosting.md">Install</a> ·
  <a href="docs/testing-release.md">macOS &amp; Windows testing</a>
</p>

![MASHINA: capture, understand and maintain your vehicles. Actual product with isolated synthetic demo data.](docs/assets/en/mashina-overview.png)

## A garage worth keeping up to date

MASHINA is a modern, open-source, self-hosted vehicle maintenance tracker and car
logbook. Keep service history, repairs, mileage, fuel and expenses on your own
server, with a mobile-friendly interface and private local storage.

- **Every vehicle, one history.** Photos, ownership, mileage, service, parts and private documents.
- **Quick fuel and expense entry.** Exact money, itemized costs, receipts and vehicle-specific defaults.
- **Analytics you can trust.** Full-to-full fuel consumption, separate purchase/sale values and clear missing-data states.
- **Bodywork with a memory.** [Interactive damage map](docs/body-damage.md), before/after photos, repair status and linked service history.
- **Tires deserve their own space.** Mounting history, manufacture codes, dated tread measurements and care guidance.
- **Built for your phone.** Dark/light themes, touch-friendly controls and an installable PWA. English, German and Russian UI, selectable at setup and in Settings. See [languages](docs/languages.md) and the [German update guide](docs/updating.de.md).
- **Local by default.** Durable offline entries, safe synchronization, SQLite + local files and complete backup/restore.

Sharing, budgets, sale-history PDFs and reviewed CSV imports are included. Notifications and a scoped API/local MCP are optional. Service addresses stay local; external maps load only when you choose. No required cloud, paid API or telemetry.

## Try it before adding your own data

Start MASHINA and choose **Explore the demo garage** (select English first) on the welcome screen. Explore two fictional vehicles, costs, fuel, tires and service history. Each demo session has its own temporary database and files, isolated from your real garage.

<details>
<summary>See the actual garage and analytics</summary>

![Garage with fictional demo cars](docs/assets/en/garage.png)
![Analytics calculated from isolated demo history](docs/assets/en/analytics.png)

</details>

## Self-host in a few commands

Linux with Docker Engine + Compose:

~~~sh
git clone https://github.com/kosavan/mashina.git
cd mashina
cp .env.example .env
mkdir -p data
sudo chown 10001:10001 data
docker compose up -d --build
docker compose exec mashina /app/.venv/bin/python -m backend.cli create-admin
~~~

Open **http://localhost:8000**. Your data live in **./data**. Use HTTPS for remote access and iPhone PWA installation.

**[Full deployment & backup guide](docs/self-hosting.md)** · **[macOS Terminal / Windows PowerShell](docs/testing-release.md)**

## Questions from car owners

### How do I track car maintenance?

Add your vehicle, then record each service with its date, odometer reading, parts
and cost. Attach receipts, review the history and set date or mileage reminders.
See the [installation guide](docs/self-hosting.md) to start your own garage.

### How do I remember when I last changed my oil?

Save the oil change as a service entry and search your vehicle history for it.
The recorded date, mileage and parts stay together. Set the next reminder using
your vehicle's service schedule; estimated mileage is not a measured reading.

### Is this a self-hosted alternative to vehicle maintenance apps?

Yes. MASHINA runs on your own computer or server with Docker. It stores your
garage in SQLite and local files, supports complete backups and includes a
phone-friendly PWA. You manage HTTPS and backups. Some actions, including photo
uploads, require a connection; physical iPhone validation remains open.

### MASHINA and LubeLogger

Both projects cover self-hosted maintenance and fuel tracking. Compare the
workflows you actually need, rather than assuming feature parity.

| Consideration | MASHINA | LubeLogger |
|---|---|---|
| Main stack | React / FastAPI / SQLite | ASP.NET Core; LiteDB and PostgreSQL dependencies |
| Installation | Docker; see our hosting guide | Docker image or standalone Windows executable |
| Try it | Isolated fictional demo inside your installation | Public hosted demo linked from its README |
| License | MIT | MIT |

MASHINA emphasizes a mobile PWA, durable offline entries, a body-damage map and
dedicated tire history. This does not assert that LubeLogger lacks those features.
LubeLogger facts were checked against its
[official repository](https://github.com/hargata/lubelog) on 2026-10-12; consult
its current documentation before choosing. There is no direct LubeLogger importer
promised here; review CSV mappings and keep your original data when migrating.

## License

MASHINA's original code is available under the [MIT license](LICENSE).
Third-party components and assets retain their respective licenses.

## Under the hood

React + TypeScript + Vite · FastAPI · SQLite/WAL · local attachments. A modular monolith in one non-root application container, designed for a small home server.

**[Development & tests](docs/development.md)** · **[Architecture](specs/001-mashina-platform)** · **[Fuel capture](docs/fuel-capture.md)** · **[Tires & service locations](docs/tires-and-locations.md)** · **[API & MCP](docs/machine-access.md)**

[Roadmap: shipped, next and research](docs/roadmap.md). Local text OCR is available;
multi-page invoice tables, specialized dashboard recognition, natural-language search,
an expense-entry bot, OBD-II and reviewed VIN/parts lookup are planned.
For existing installations, follow the [backup, update and rollback guide](docs/updating.md).

Built with [Spec Kit](https://github.com/github/spec-kit); identity developed with [logo-design-skill](https://github.com/kaankiziltug/logo-design-skill), infographic authored with [Hyperframes](https://github.com/heygen-com/hyperframes).

Vibecoded with love ❤️
