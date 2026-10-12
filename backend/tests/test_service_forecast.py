"""Known maintenance estimates never become actual financial events."""

import pytest
from backend.domain import normalize_reminder
from backend.ownership import ownership_report
from backend.tests.test_api import mutate


@pytest.mark.parametrize(
    "raw,expected",
    [("1234.56", 123456), ("12,34", 1234), ("", None), ("0", 0), ("10000000000", 10**12)],
)
def test_exact_optional_estimate(raw, expected):
    result = normalize_reminder(
        {"title": "Oil", "due_date": "2026-10-15", "estimated_cost": raw, "cost_currency": "eur"}
    )
    assert result["estimated_cost_minor"] == expected
    assert result["cost_currency"] == "EUR"
    assert "estimated_cost" not in result


@pytest.mark.parametrize("raw", ["-1", "NaN", "Infinity", "1.001", "10000000000.01"])
def test_invalid_estimates_rejected(raw):
    with pytest.raises(ValueError):
        normalize_reminder({"title": "Oil", "due_date": "2026-10-15", "estimated_cost": raw})


def test_next_only_forecast_boundaries_and_actual_invariance():
    def reminder(id, **values):
        return {
            "id": id,
            "vehicle_id": "v",
            "title": id,
            "due_date": "2026-10-01",
            "due_odometer": None,
            "estimated_cost_minor": 123456,
            "cost_currency": "RUB",
            **values,
        }

    rows = [
        reminder("date", repeat_days=30),
        reminder("combined", due_odometer=10000),
        reminder("km", due_date="", due_odometer=10000),
        reminder("unknown", estimated_cost_minor=None),
        reminder("zero", estimated_cost_minor=0),
        reminder("end", due_date="2027-10-01"),
        reminder("old", due_date="2026-09-30"),
        reminder("disabled", enabled=False),
        reminder("done", completed_at="2026-10-01"),
        reminder("deleted", deleted=True),
        reminder("other", vehicle_id="other"),
    ]
    state = {"events": [], "reminders": rows}
    report = ownership_report(state, "v", "2026-10")
    forecast = report["forecast"]
    assert {r["id"] for r in forecast} == {"date", "combined", "zero"}
    assert all(r["source"] == "maintenance" and r["estimated"] for r in forecast)
    assert next(r for r in forecast if r["id"] == "combined")["mileage_deadline"]
    assert len(forecast) == 3 and state["events"] == []
    assert {r["id"] for r in report["maintenance_due"]} == {
        "date",
        "combined",
        "km",
        "unknown",
        "zero",
        "old",
    }


def test_estimate_edit_clear_backup_and_repeat_criteria(client, tmp_path):
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store

    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    r = mutate(
        client,
        "reminder",
        {
            "vehicle_id": car["id"],
            "title": "Oil",
            "due_date": "2026-10-10",
            "due_odometer": 10000,
            "repeat_days": 30,
            "estimated_cost": "1234.56",
        },
    ).json()["record"]
    done = mutate(
        client,
        "reminder",
        {"completion_date": "2026-10-11"},
        action="complete",
        id=r["id"],
        expected_version=1,
    )
    assert done.status_code == 200, done.text
    assert done.json()["record"]["due_date"] == "2026-11-10"
    assert done.json()["record"]["due_odometer"] is None
    assert done.json()["record"]["estimated_cost_minor"] == 123456
    restored = Store(tmp_path / "restored")
    restore_backup(restored, make_backup(client.app.state.store))
    import json

    assert (
        json.loads(restored.query("SELECT data FROM reminders")[0]["data"])["estimated_cost_minor"]
        == 123456
    )
    restored.close()
    cleared = mutate(
        client, "reminder", {"estimated_cost": ""}, action="update", id=r["id"], expected_version=2
    )
    assert cleared.json()["record"]["estimated_cost_minor"] is None
    assert client.get("/api/v1/state").json()["events"] == []


def test_km_repeat_requires_confirmed_odometer_and_clears_old_date(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    r = mutate(
        client,
        "reminder",
        {
            "vehicle_id": car["id"],
            "title": "Oil",
            "due_date": "2026-10-01",
            "due_odometer": 10000,
            "repeat_km": 5000,
        },
    ).json()["record"]
    args = {"action": "complete", "id": r["id"], "expected_version": 1}
    assert mutate(client, "reminder", {"completion_date": "2026-10-11"}, **args).status_code == 422
    result = mutate(
        client, "reminder", {"completion_date": "2026-10-11", "completion_odometer": 10001}, **args
    ).json()["record"]
    assert result["due_odometer"] == 15001 and result["due_date"] == ""


def test_corrupted_estimate_archive_does_not_replace_live_history(client, tmp_path):
    import json
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store, dumps

    car = mutate(client, "vehicle", {"name": "Source"}).json()["record"]
    mutate(
        client,
        "reminder",
        {"vehicle_id": car["id"], "title": "Oil", "due_date": "2026-10-20", "estimated_cost": "1"},
    )
    with client.app.state.store.transaction() as c:
        row = c.exec_driver_sql("SELECT id,data FROM reminders").first()
        data = json.loads(row[1])
        data["estimated_cost_minor"] = -1
        c.exec_driver_sql("UPDATE reminders SET data=? WHERE id=?", (dumps(data), row[0]))
    target = Store(tmp_path / "live")
    with pytest.raises(ValueError, match="стоимость"):
        restore_backup(target, make_backup(client.app.state.store))
    assert target.query("SELECT * FROM vehicles") == []
    target.close()


def test_legacy_reminder_defaults_unknown_and_repeated_km_needs_fresh_confirmation(client):
    assert (
        normalize_reminder({"title": "Old", "due_date": "2026-10-20"})["estimated_cost_minor"]
        is None
    )
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    r = mutate(
        client,
        "reminder",
        {"vehicle_id": car["id"], "title": "Oil", "due_odometer": 10000, "repeat_km": 5000},
    ).json()["record"]
    first = mutate(
        client,
        "reminder",
        {"completion_odometer": 10001},
        action="complete",
        id=r["id"],
        expected_version=1,
    )
    assert first.status_code == 200
    assert "completion_odometer" not in first.json()["record"]
    assert (
        mutate(
            client, "reminder", {}, action="complete", id=r["id"], expected_version=2
        ).status_code
        == 422
    )
