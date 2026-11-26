import uuid

from backend.tests.test_access import account, grant
from backend.tests.test_api import mutate


def concern(client, car, description="Check the wheel bearing"):
    response = mutate(
        client,
        "event",
        {
            "kind": "note",
            "vehicle_id": car,
            "occurred_at": "2025-10-01",
            "description": description,
            "service_concern": True,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["record"]


def maintenance_data(car, concern_id):
    return {
        "kind": "maintenance",
        "vehicle_id": car,
        "occurred_at": "2025-10-05",
        "description": "Wheel bearing replaced",
        "items": [{"name": "Wheel bearing", "part_number": "A123", "unit_price": "123.45"}],
        "service_visit": {
            "concern_ids": [concern_id],
            "follow_up": "Check noise again",
            "concerns": [{"id": concern_id, "description": "Untrusted input"}],
        },
    }


def test_service_visits_are_atomic_idempotent_and_keep_original_concerns(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    note = concern(client, car)
    data = maintenance_data(car, note["id"])
    operation = str(uuid.uuid4())
    record = str(uuid.uuid4())
    created = mutate(client, "event", data, operation_id=operation, id=record)
    assert created.status_code == 200, created.text
    assert mutate(client, "event", data, operation_id=operation, id=record).json() == created.json()
    visit = created.json()["record"]
    assert visit["amount_minor"] == 12345
    assert visit["service_visit"] == {
        "concern_ids": [note["id"]],
        "concerns": [{"id": note["id"], "description": note["description"]}],
        "follow_up": "Check noise again",
    }
    assert mutate(client, "event", data).status_code == 422
    edited = mutate(
        client,
        "event",
        {"description": "New description"},
        id=note["id"],
        action="update",
        expected_version=note["version"],
    )
    assert edited.status_code == 200, edited.text
    legacy_edit = mutate(
        client,
        "event",
        {"vendor": "Workshop"},
        id=record,
        action="update",
        expected_version=visit["version"],
    )
    assert legacy_edit.json()["record"]["service_visit"] == visit["service_visit"]
    deleted = mutate(client, "event", {}, id=record, action="delete", expected_version=2)
    assert deleted.status_code == 200, deleted.text
    assert mutate(client, "event", data).status_code == 200
    assert (
        mutate(client, "event", {}, id=record, action="restore", expected_version=3).status_code
        == 422
    )
    analytics = client.get("/api/v1/analytics", params={"vehicle_id": car})
    assert analytics.status_code == 200
    assert analytics.json()["total_minor"] == 12345


def test_service_concerns_require_matching_vehicle_and_edit_permission(client):
    shared = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    other = mutate(client, "vehicle", {"name": "Private"}).json()["record"]["id"]
    driver, user_id = account(client, "driver")
    assert grant(client, shared, user_id).status_code == 200
    owner_note = concern(client, shared)
    hidden_note = concern(client, other)
    driver_note = concern(driver, shared)
    assert mutate(driver, "event", maintenance_data(shared, owner_note["id"])).status_code == 403
    assert mutate(driver, "event", maintenance_data(shared, hidden_note["id"])).status_code == 403
    assert mutate(client, "event", maintenance_data(shared, hidden_note["id"])).status_code == 422
    assert mutate(driver, "event", maintenance_data(shared, driver_note["id"])).status_code == 200
