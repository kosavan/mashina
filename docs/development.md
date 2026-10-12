# Development

Requirements: Python 3.12+, uv, Node 20.19+ (CI/Docker use Node 22).

```sh
uv sync --extra dev
npm --prefix frontend ci
uv run uvicorn backend.app:app --reload
# In another terminal:
npm --prefix frontend run dev
```

Vite proxies `/api` to the local backend. For a production preview, build the frontend and restart the backend. Never use a real garage for automated tests.

```sh
uv run ruff check backend tools
uv run python tools/check_docs.py
uv run python tools/check_migrations.py
uv run pytest
npm --prefix frontend run check
npm --prefix frontend test
npm --prefix frontend run build
cd frontend
npx playwright install chromium
npm run test:e2e
```

The suites cover financial invariants, fuel cycles, mileage, permissions, idempotency, migrations, archive restoration, demo isolation and mobile/offline journeys. Main JavaScript budget is 180 KiB gzip; analytics load lazily. A synthetic 10,000-event calculation has a one-second test budget, not a measurement of your particular server. Compose limits the application to 1 CPU / 512 MiB.

Every change must preserve supported installed data and offline queues. Do not edit
released migrations or the frozen initial schema; add a revision and extend the
real-schema upgrade matrix. Update [roadmap](roadmap.md), English/Russian guides
and [update/rollback instructions](updating.md) when behavior changes. CI also
restores a synthetic garage inside a read-only non-root production container.

[Architecture and contracts](../specs/001-mashina-platform), [engineering constitution](../.specify/memory/constitution.md), [product polish specification](../specs/010-product-polish). Spec Kit tooling and local environments are ignored. [Brand masters](../design/identity/usage.md) and [Hyperframes infographic source](../design/showcase/README.md) are separate development artifacts, with no added application runtime dependency.
