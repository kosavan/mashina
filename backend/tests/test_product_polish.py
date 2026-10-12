import uuid
import pytest
from backend.domain import normalize_event
from backend.ownership import normalize_ownership
from backend.tests.test_api import mutate


def measured(depth="6.3", **extra):
    return {"id": str(uuid.uuid4()), "measured_at": "2026-01-01", "depth_mm": depth, **extra}


def test_tire_measurements_exact_and_old_payload_compatible():
    old = normalize_ownership("tire_set", {"brand": "Example"})
    assert old["manufacture_code"] == "" and old["tread_measurements"] == []
    result = normalize_ownership(
        "tire_set",
        {
            "brand": "Example",
            "manufacture_code": "3421",
            "tread_threshold_mm": "4,1",
            "tread_measurements": [measured("6,3")],
        },
    )
    assert result["tread_measurements"][0]["depth_tenths"] == 63
    assert result["tread_threshold_tenths"] == 41
    assert "tread_threshold_mm" not in result
    assert normalize_ownership("tire_set", result) == result


@pytest.mark.parametrize(
    "fields",
    [
        {"manufacture_code": "0021"},
        {"manufacture_code": "5421"},
        {"manufacture_code": "3499"},
        {"tread_measurements": [measured("-1")]},
        {"tread_measurements": [measured("NaN")]},
        {"tread_measurements": [measured("3.21")]},
        {"tread_measurements": [measured("31")]},
        {"tread_measurements": [measured(measured_at="2099-01-01")]},
        {"tread_threshold_mm": "0"},
        {"tread_threshold_mm": "20.1"},
    ],
)
def test_reject_invalid_tire_measurements(fields):
    with pytest.raises(ValueError):
        normalize_ownership("tire_set", {"brand": "Example", **fields})


def test_duplicate_measurement_id_rejected():
    row = measured()
    with pytest.raises(ValueError):
        normalize_ownership("tire_set", {"brand": "Example", "tread_measurements": [row, row]})


@pytest.mark.parametrize(
    "fields",
    [
        {"service_latitude": "1"},
        {"service_longitude": "1"},
        {"service_latitude": "91", "service_longitude": "0"},
        {"service_latitude": "0", "service_longitude": "181"},
        {"service_latitude": "NaN", "service_longitude": "0"},
        {"service_address": "a" * 501},
    ],
)
def test_reject_invalid_service_location(fields):
    with pytest.raises(ValueError):
        normalize_event({"kind": "note", "occurred_at": "2026-01-01", **fields})


def test_tire_location_backup_and_idempotent_replay(client, tmp_path):
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store

    car = mutate(client, "vehicle", {"name": "Invented car"}).json()["record"]
    payload = {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "tire_set",
        "action": "create",
        "data": {
            "vehicle_id": car["id"],
            "brand": "Example",
            "manufacture_code": "3421",
            "tread_measurements": [measured()],
        },
    }
    first = client.post("/api/v1/mutate", json=payload)
    assert first.status_code == 200, first.text
    assert client.post("/api/v1/mutate", json=payload).json() == first.json()
    event = mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "maintenance",
            "occurred_at": "2026-01-02",
            "amount": "100",
            "service_address": "Вымышленный сервис, 1",
            "service_latitude": "55.75",
            "service_longitude": "37.61",
        },
    )
    assert event.status_code == 200, event.text
    state = client.get("/api/v1/state").json()
    assert len(state["tire_sets"]) == 1
    assert len(state["events"]) == 1
    archive = make_backup(client.app.state.store)
    restored = Store(tmp_path / "restored-polish")
    try:
        restore_backup(restored, archive)
        owner = restored.query("SELECT id FROM users")[0]["id"]
        recovered = restored.state(owner)
        assert (
            recovered["tire_sets"][0]["tread_measurements"]
            == state["tire_sets"][0]["tread_measurements"]
        )
        assert recovered["events"][0]["service_address"] == "Вымышленный сервис, 1"
        assert recovered["events"][0]["service_latitude"] == "55.75"
    finally:
        restored.close()


def test_tire_measurements_follow_vehicle_permissions(client):
    from backend.tests.test_access import account, grant

    driver, user = account(client, "tire-driver")
    car = mutate(client, "vehicle", {"name": "Shared tires"}).json()["record"]["id"]
    tire = mutate(
        client,
        "tire_set",
        {"vehicle_id": car, "brand": "Example", "tread_measurements": [measured()]},
    ).json()["record"]
    assert driver.get("/api/v1/state").json()["tire_sets"] == []
    assert grant(client, car, user).status_code == 200
    assert driver.get("/api/v1/state").json()["tire_sets"][0]["id"] == tire["id"]
    update = mutate(
        driver,
        "tire_set",
        {"tread_measurements": [measured("1.1")]},
        id=tire["id"],
        action="update",
        expected_version=1,
    )
    assert update.status_code == 403
    assert client.delete(f"/api/v1/vehicles/{car}/access/{user}").status_code == 200
    assert driver.get("/api/v1/state").json()["tire_sets"] == []
