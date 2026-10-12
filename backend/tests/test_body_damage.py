"""Condition records preserve exact finances, authorization and installed history."""

import io
import uuid

import pytest
from PIL import Image

from backend.tests.test_api import mutate
from backend.tests.test_access import account, grant


def damage_data(car, **extra):
    return {
        "vehicle_id": car,
        "title": "Door scratch",
        "view": "left",
        "panel": "left_front_door",
        "x": 0.45,
        "y": 0.55,
        "discovered_on": "2026-01-02",
        **extra,
    }


def image(client, car):
    data = io.BytesIO()
    Image.new("RGB", (24, 24), "green").save(data, "PNG")
    response = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car, "title": "Before"},
        files={"file": ("before.png", data.getvalue(), "image/png")},
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_damage_crud_history_and_exact_replay_never_changes_finances(client):
    car = mutate(client, "vehicle", {"name": "Keep totals", "purchase_odometer": 1000}).json()[
        "record"
    ]["id"]
    service = mutate(
        client,
        "event",
        {
            "vehicle_id": car,
            "kind": "maintenance",
            "occurred_at": "2026-01-02",
            "amount": "1234.56",
        },
    ).json()["record"]
    payload = {
        "entity": "body_damage",
        "action": "create",
        "id": str(uuid.uuid4()),
        "operation_id": str(uuid.uuid4()),
        "data": damage_data(
            car,
            odometer=10,
            estimate="123.45",
            maintenance_event_id=service["id"],
            status_history=[{"status": "forged"}],
        ),
    }
    first = client.post("/api/v1/mutate", json=payload)
    assert first.status_code == 200, first.text
    record = first.json()["record"]
    assert record["estimate_minor"] == 12345
    assert [h["status"] for h in record["status_history"]] == ["observed"]
    assert client.post("/api/v1/mutate", json=payload).json() == first.json()
    other = mutate(client, "body_damage", damage_data(car, title="Second scratch"))
    assert other.status_code == 200, other.text
    for status in ("repaired", "needs_repair"):
        result = mutate(
            client,
            "body_damage",
            {"status": status},
            action="update",
            id=record["id"],
            expected_version=record["version"],
        )
        assert result.status_code == 200, result.text
        record = result.json()["record"]
    assert [h["status"] for h in record["status_history"]] == [
        "observed",
        "repaired",
        "needs_repair",
    ]
    assert (
        mutate(
            client,
            "body_damage",
            {"title": "Stale"},
            action="update",
            id=record["id"],
            expected_version=1,
        ).status_code
        == 409
    )
    for action in ("delete", "restore"):
        result = mutate(
            client,
            "body_damage",
            {},
            action=action,
            id=record["id"],
            expected_version=record["version"],
        )
        assert result.status_code == 200, result.text
        record = result.json()["record"]
        assert record["deleted"] == (action == "delete")
    state = client.get("/api/v1/state").json()
    assert len(state["body_damages"]) == 2
    assert state["vehicles"][0]["current_odometer"] == 1000
    assert len(state["events"]) == 1
    assert client.get("/api/v1/analytics").json()["total_minor"] == 123456
    assert "body_damages" in client.get("/api/v1/export.csv").text
    assert len(client.get("/api/v1/export.json").json()["body_damages"]) == 2


@pytest.mark.parametrize(
    "invalid",
    [
        {"x": -0.01},
        {"y": 1.01},
        {"x": "NaN"},
        {"view": "unknown"},
        {"panel": "roof"},
        {"status": "unknown"},
        {"severity": "unknown"},
        {"damage_type": "unknown"},
        {"title": ""},
        {"odometer": -1},
        {"odometer": "1.5"},
        {"discovered_on": "2099-01-01"},
        {"repaired_on": "2025-01-01"},
        {"estimate": "-1"},
        {"notes": "x" * 4001},
    ],
)
def test_damage_validation(client, invalid):
    car = mutate(client, "vehicle", {"name": "Validate"}).json()["record"]["id"]
    result = mutate(client, "body_damage", damage_data(car, **invalid))
    assert result.status_code == 422, result.text


def test_links_are_same_car_images_and_maintenance_and_can_be_cleared(client):
    car, other = [
        mutate(client, "vehicle", {"name": name}).json()["record"]["id"]
        for name in ("Car", "Other")
    ]
    photo = image(client, car)
    foreign = image(client, other)
    expense = mutate(
        client,
        "event",
        {"vehicle_id": car, "kind": "expense", "occurred_at": "2026-01-02", "amount": "1"},
    ).json()["record"]
    for fields in (
        {"photos": [{"attachment_id": foreign, "phase": "before"}]},
        {"maintenance_event_id": expense["id"]},
    ):
        assert mutate(client, "body_damage", damage_data(car, **fields)).status_code == 422
    result = mutate(
        client,
        "body_damage",
        damage_data(car, photos=[{"attachment_id": photo, "phase": "before"}]),
    )
    assert result.status_code == 200, result.text
    record = result.json()["record"]
    assert client.delete(f"/api/v1/attachments/{photo}").status_code == 200
    edited = mutate(
        client,
        "body_damage",
        {"notes": "Evidence removed intentionally"},
        action="update",
        id=record["id"],
        expected_version=1,
    )
    assert edited.status_code == 200, edited.text
    assert (
        mutate(
            client,
            "body_damage",
            {"photos": []},
            action="update",
            id=record["id"],
            expected_version=2,
        ).status_code
        == 200
    )


def test_damage_permissions_and_private_evidence(client):
    car = mutate(client, "vehicle", {"name": "Private"}).json()["record"]["id"]
    aid = image(client, car)
    record = mutate(
        client, "body_damage", damage_data(car, photos=[{"attachment_id": aid, "phase": "before"}])
    ).json()["record"]
    driver, user = account(client, "condition-driver")
    assert driver.get("/api/v1/state").json()["body_damages"] == []
    assert grant(client, car, user).status_code == 200
    state = driver.get("/api/v1/state").json()
    assert state["body_damages"][0]["can_edit"] is False
    assert state["attachments"] == []
    assert driver.get(f"/api/v1/attachments/{aid}").status_code == 403
    assert mutate(driver, "body_damage", damage_data(car)).status_code == 403
    assert (
        mutate(
            driver,
            "body_damage",
            {"status": "repaired"},
            action="update",
            id=record["id"],
            expected_version=1,
        ).status_code
        == 403
    )


def test_damage_backup_restore_and_archive_preserve_evidence(client, tmp_path):
    from backend.storage import Store
    from backend.backup import make_backup, restore_backup

    car = mutate(client, "vehicle", {"name": "History"}).json()["record"]
    aid = image(client, car["id"])
    record = mutate(
        client,
        "body_damage",
        damage_data(car["id"], photos=[{"attachment_id": aid, "phase": "before"}]),
    ).json()["record"]
    assert (
        mutate(
            client,
            "vehicle",
            {"status": "archived"},
            id=car["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 200
    )
    restored = Store(tmp_path / "restored-damage")
    restore_backup(restored, make_backup(client.app.state.store))
    owner = restored.query("SELECT id FROM users")[0]["id"]
    state = restored.state(owner)
    assert state["body_damages"][0]["id"] == record["id"]
    assert state["body_damages"][0]["status_history"] == record["status_history"]
    assert state["vehicles"][0]["status"] == "archived"
    assert state["attachments"][0]["id"] == aid
    restored.close()


def test_deleted_repair_keeps_damage_editable_without_new_financial_entry(client):
    car = mutate(client, "vehicle", {"name": "Preserved repair"}).json()["record"]["id"]
    service = mutate(
        client,
        "event",
        {"vehicle_id": car, "kind": "maintenance", "occurred_at": "2026-01-02", "amount": "123.45"},
    ).json()["record"]
    record = mutate(
        client, "body_damage", damage_data(car, maintenance_event_id=service["id"])
    ).json()["record"]
    assert (
        mutate(
            client, "event", {}, id=service["id"], action="delete", expected_version=1
        ).status_code
        == 200
    )
    assert (
        mutate(
            client,
            "body_damage",
            {"notes": "Keep the original repair reference"},
            id=record["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 200
    )
    assert (
        mutate(
            client, "body_damage", damage_data(car, maintenance_event_id=service["id"])
        ).status_code
        == 422
    )
    assert client.get("/api/v1/analytics").json()["total_minor"] == 0


@pytest.mark.parametrize("corruption", ["foreign_image", "nonimage", "history", "owner", "shape"])
def test_restore_rejects_corrupt_damage_before_touching_live_garage(client, tmp_path, corruption):
    import hashlib
    import json
    import sqlite3
    import zipfile
    from backend.backup import make_backup, restore_backup

    car = mutate(client, "vehicle", {"name": "Live car"}).json()["record"]["id"]
    other = mutate(client, "vehicle", {"name": "Other car"}).json()["record"]["id"]
    aid = image(client, car)
    record = mutate(
        client, "body_damage", damage_data(car, photos=[{"attachment_id": aid, "phase": "before"}])
    ).json()["record"]
    store = client.app.state.store
    with zipfile.ZipFile(io.BytesIO(make_backup(store))) as source:
        files = {name: source.read(name) for name in source.namelist() if name != "manifest.json"}
    snapshot = tmp_path / "tampered.sqlite"
    snapshot.write_bytes(files["database.sqlite"])
    with sqlite3.connect(snapshot) as c:
        c.execute("PRAGMA journal_mode=DELETE")
        if corruption == "foreign_image":
            c.execute("UPDATE attachments SET vehicle_id=? WHERE id=?", (other, aid))
        elif corruption == "nonimage":
            data = json.loads(
                c.execute("SELECT data FROM attachments WHERE id=?", (aid,)).fetchone()[0]
            )
            data["media_type"] = "application/pdf"
            c.execute("UPDATE attachments SET data=? WHERE id=?", (json.dumps(data), aid))
        elif corruption == "owner":
            c.execute("UPDATE body_damages SET owner_id=?", (str(uuid.uuid4()),))
        elif corruption == "shape":
            c.execute("UPDATE body_damages SET data='[]'")
        else:
            data = json.loads(c.execute("SELECT data FROM body_damages").fetchone()[0])
            data["status_history"][-1]["status"] = "repaired"
            c.execute("UPDATE body_damages SET data=?", (json.dumps(data),))
    files["database.sqlite"] = snapshot.read_bytes()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as target:
        for name, blob in files.items():
            target.writestr(name, blob)
        target.writestr(
            "manifest.json",
            json.dumps(
                {
                    "format": 1,
                    "files": {
                        name: hashlib.sha256(blob).hexdigest() for name, blob in files.items()
                    },
                }
            ),
        )
    with pytest.raises(ValueError):
        restore_backup(store, output.getvalue())
    assert (
        store.state(store.query("SELECT id FROM users")[0]["id"])["body_damages"][0]["id"]
        == record["id"]
    )
    assert client.get(f"/api/v1/attachments/{aid}").status_code == 200
