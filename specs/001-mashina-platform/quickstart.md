# Validation quickstart

1. `uv sync --extra dev`; `npm --prefix frontend ci`; `npm --prefix frontend run build`.
2. `uv run python -m backend.cli bootstrap` writes a one-time local setup token to data/.bootstrap-token without printing it.
3. `uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000 --workers 1`.
4. Open localhost:8000; create account using token, add two cars and upload photos.
5. Add expense items, two full fuel entries with a partial between, and maintenance
   with a PDF and part number. Verify totals, search, edit, delete and undo.
6. Add reminder, verify due/soon states. Archive and restore a car.
7. Install PWA over HTTPS on iPhone; load once, go offline, add expense and mileage,
   reload, reconnect with app open; verify one server event per mutation.
8. Download archive, restore on disposable clean installation, compare bytes and IDs.
9. `uv run pytest`; `npm --prefix frontend test`; `npm --prefix frontend run check`.
10. `docker compose up -d --build`; configure HTTPS using Caddyfile.example and test
    volume persistence after recreation. Physical iPhone and container checks require
    their respective device/runtime; record them separately from desktop automation.


