import pytest
from backend.ownership import normalize_ownership, ownership_report, csv_rows
from backend.tests.test_api import mutate


def test_tire_usage_and_invalid_overlaps():
    tire = normalize_ownership(
        "tire_set",
        {
            "brand": "Test",
            "season": "winter",
            "intervals": [
                {
                    "mounted_at": "2026-01-01",
                    "mounted_km": 100000,
                    "removed_at": "2026-03-01",
                    "removed_km": 105000,
                }
            ],
        },
    )
    assert tire["confirmed_km"] == 5000
    with pytest.raises(ValueError):
        normalize_ownership(
            "tire_set",
            {
                **tire,
                "intervals": tire["intervals"]
                + [{"mounted_at": "2026-02-01", "mounted_km": 106000}],
            },
        )
    with pytest.raises(ValueError):
        normalize_ownership(
            "tire_set",
            {
                **tire,
                "intervals": [
                    {
                        "mounted_at": "2026-01-01",
                        "mounted_km": 100,
                        "removed_at": "2026-02-01",
                        "removed_km": 99,
                    }
                ],
            },
        )


def test_budget_and_forecast_never_create_financial_events():
    state = {
        "events": [
            {
                "id": "e",
                "vehicle_id": "v",
                "kind": "expense",
                "occurred_at": "2026-01-03",
                "currency": "RUB",
                "amount_minor": 250000,
            }
        ],
        "budgets": [
            {"vehicle_id": "v", "month": "2026-01", "currency": "RUB", "amount_minor": 1000000}
        ],
        "recurring_costs": [
            {
                "vehicle_id": "v",
                "title": "Parking",
                "currency": "RUB",
                "amount_minor": 100000,
                "next_date": "2026-01-31",
                "interval_months": 1,
                "enabled": True,
            }
        ],
    }
    report = ownership_report(state, "v", "2026-01")
    assert report["budgets"][0]["remaining_minor"] == 750000
    assert report["forecast"][1]["date"] == "2026-02-28"
    assert len(state["events"]) == 1


def test_tire_budget_crud_and_csv_repeat(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    tire = mutate(
        client, "tire_set", {"vehicle_id": car["id"], "brand": "Michelin", "season": "winter"}
    )
    assert tire.status_code == 200, tire.text
    budget = mutate(
        client,
        "budget",
        {"vehicle_id": car["id"], "month": "2026-01", "amount": "10000", "currency": "RUB"},
    )
    assert budget.status_code == 200, budget.text
    content = "external_id,occurred_at,kind,amount,description\nrow-1,2026-01-02,expense,2500,Imported\nrow-2,2026-01-03,expense,-3,Invalid\n"
    preview = client.post(
        "/api/v1/import/csv/preview",
        data={"vehicle_id": car["id"]},
        files={"file": ("history.csv", content.encode(), "text/csv")},
    )
    assert preview.status_code == 200, preview.text
    rows = preview.json()["rows"]
    assert not rows[0].get("error")
    assert rows[1]["error"]
    payload = {"vehicle_id": car["id"], "rows": [rows[0]["source"]], "confirm_odometer": False}
    first = client.post("/api/v1/import/csv/commit", json=payload)
    assert first.status_code == 200, first.text
    assert client.post("/api/v1/import/csv/commit", json=payload).status_code == 200
    state = client.get("/api/v1/state").json()
    assert len(state["events"]) == 1
    assert len(state["tire_sets"]) == 1
    assert (
        client.get(f"/api/v1/ownership?vehicle_id={car['id']}&month=2026-01").json()["budgets"][0][
            "remaining_minor"
        ]
        == 750000
    )


def test_csv_limits_and_reordered_ids():
    rows = csv_rows(b"occurred_at,kind,amount\n2026-01-01,expense,1\n", "owner", "vehicle")
    again = csv_rows(b"occurred_at,kind,amount\n2026-01-01,expense,1\n", "owner", "vehicle")
    assert rows[0]["id"] == again[0]["id"]
    with pytest.raises(ValueError):
        csv_rows(b"unexpected\nvalue", "owner", "vehicle")


def test_restore_mvp_archive_upgrades_additively(client, tmp_path):
    import hashlib
    import io
    import json
    import sqlite3
    import zipfile
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store

    car = mutate(client, "vehicle", {"name": "MVP preserved"}).json()["record"]
    archive = make_backup(client.app.state.store)
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        files = {name: source.read(name) for name in source.namelist() if name != "manifest.json"}
    snapshot = tmp_path / "old.sqlite"
    snapshot.write_bytes(files["database.sqlite"])
    with sqlite3.connect(snapshot) as connection:
        for name in ("tire_sets", "budgets", "recurring_costs"):
            connection.execute(f"DROP TABLE {name}")
        connection.execute("UPDATE alembic_version SET version_num='001'")
    files["database.sqlite"] = snapshot.read_bytes()
    manifest = {
        "format": 1,
        "files": {name: hashlib.sha256(blob).hexdigest() for name, blob in files.items()},
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as target:
        for name, blob in files.items():
            target.writestr(name, blob)
        target.writestr("manifest.json", json.dumps(manifest))
    restored = Store(tmp_path / "restored")
    restore_backup(restored, output.getvalue())
    owner = restored.query("SELECT id FROM users")[0]["id"]
    assert restored.state(owner)["vehicles"][0]["id"] == car["id"]
    assert restored.state(owner)["tire_sets"] == []
    assert restored.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "002"
    restored.close()


def test_failed_restore_migration_recovers_original(client, monkeypatch):
    from backend.backup import make_backup, restore_backup

    car = mutate(client, "vehicle", {"name": "Before"}).json()["record"]
    store = client.app.state.store
    archive = make_backup(store)
    assert (
        mutate(
            client,
            "vehicle",
            {"name": "Keep live"},
            id=car["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 200
    )

    def fail():
        raise RuntimeError("simulated migration failure")

    monkeypatch.setattr(store, "migrate", fail)
    with pytest.raises(RuntimeError):
        restore_backup(store, archive)
    assert client.get("/api/v1/state").json()["vehicles"][0]["name"] == "Keep live"


def test_csv_batch_is_atomic_on_conflict(client):
    car = mutate(client, "vehicle", {"name": "Import car"}).json()["record"]
    first = {"external_id": "one", "occurred_at": "2026-01-01", "kind": "expense", "amount": "10"}
    endpoint = "/api/v1/import/csv/commit"
    assert client.post(endpoint, json={"vehicle_id": car["id"], "rows": [first]}).status_code == 200
    second = {**first, "external_id": "two"}
    changed = {**first, "amount": "20"}
    response = client.post(endpoint, json={"vehicle_id": car["id"], "rows": [second, changed]})
    assert response.status_code == 409
    assert len(client.get("/api/v1/state").json()["events"]) == 1
