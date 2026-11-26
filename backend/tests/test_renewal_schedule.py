from datetime import date, datetime, time, timedelta
import uuid

from fastapi.testclient import TestClient

from backend.notification_delivery import dispatch, due_targets
from backend.notification_transport import ProviderResult
from backend.notifications import initialize_identity
from backend.tests.test_access import account, grant
from backend.tests.test_api import mutate
from backend.tests.test_notifications import subscription


def add_renewal(client, vehicle_id, paid, expires):
    response = mutate(
        client,
        "event",
        {
            "vehicle_id": vehicle_id,
            "kind": "expense",
            "description": "Private renewal note",
            "amount": "123.45",
            "occurred_at": paid.isoformat(),
            "renewal": {"type": "insurance", "expires_on": expires.isoformat()},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["record"]


def test_reminder_follows_renewal_and_retires_old_delivery_cycle(client):
    today = date.today()
    old_expiry = today + timedelta(days=14)
    new_expiry = today + timedelta(days=100)
    car = mutate(client, "vehicle", {"name": "Hidden garage name"}).json()["record"]
    first = add_renewal(client, car["id"], today - timedelta(days=1), old_expiry)
    store = client.app.state.store
    initialize_identity(store)
    assert client.post("/api/v1/notifications/push", json=subscription()).status_code == 200
    schedule = {
        "vehicle_id": car["id"],
        "title": "Insurance",
        "renewal_schedule": {"type": "insurance", "lead_days": 14},
    }
    payload = {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "reminder",
        "action": "create",
        "data": schedule,
    }
    saved = client.post("/api/v1/mutate", json=payload)
    assert saved.status_code == 200, saved.text
    assert client.post("/api/v1/mutate", json=payload).json() == saved.json()
    assert mutate(client, "reminder", schedule).status_code == 409
    assert mutate(
        client, "reminder", {**schedule, "renewal_schedule": {"type": "insurance", "lead_days": 10}}
    ).status_code == 422
    record_id = saved.json()["record"]["id"]

    def current():
        return next(r for r in client.get("/api/v1/state").json()["reminders"] if r["id"] == record_id)

    def stamp(day):
        return int(datetime.combine(day, time(12)).timestamp())

    assert current()["due_date"] == old_expiry.isoformat()
    assert current()["status"] == "soon"
    assert due_targets(store, stamp(today - timedelta(days=1)), reminder_id=record_id) == []
    [old] = due_targets(store, stamp(today), reminder_id=record_id)
    calls = []

    def accepted(*_):
        calls.append(True)
        return ProviderResult("accepted")

    assert dispatch(store, now=stamp(today), send=True, transport=accepted)["accepted"] == 1
    assert dispatch(store, now=stamp(today), send=True, transport=accepted)["accepted"] == 0
    old_cycle = current()["renewal_cycle"]
    assert mutate(
        client, "reminder", {"renewal_expected_cycle": old_cycle}, action="complete",
        id=record_id, expected_version=1,
    ).status_code == 200
    assert current()["status"] == "completed"
    second = add_renewal(client, car["id"], today, new_expiry)
    assert current()["due_date"] == new_expiry.isoformat()
    assert current()["status"] == "normal"
    assert current()["version"] == 2
    assert current()["completed_at"] == ""
    assert mutate(
        client, "reminder", {"renewal_expected_cycle": old_cycle}, action="complete",
        id=record_id, expected_version=2,
    ).status_code == 409
    assert due_targets(store, stamp(old_expiry), reminder_id=record_id) == []
    at_warning = stamp(new_expiry - timedelta(days=14))
    [new] = due_targets(store, at_warning, reminder_id=record_id)
    assert new["cycle"] != old["cycle"]
    assert dispatch(store, now=at_warning, send=True, transport=accepted)["accepted"] == 1
    assert len(calls) == 2

    for event in (second, first):
        assert mutate(
            client, "event", {}, action="delete", id=event["id"], expected_version=1
        ).status_code == 200
    assert current()["renewal_active"] is False
    assert due_targets(store, at_warning, reminder_id=record_id) == []


def test_calendar_exports_one_private_date_and_checks_vehicle_access(client):
    today = date.today()
    expires = today + timedelta(days=50)
    car = mutate(client, "vehicle", {"name": "Hidden garage name"}).json()["record"]
    record = add_renewal(client, car["id"], today, expires)
    url = f"/api/v1/renewals/{record['id']}/calendar"
    assert TestClient(client.app).get(url).status_code == 401
    driver, driver_id = account(client, "calendar-driver")
    assert driver.get(url).status_code == 403
    assert grant(client, car["id"], driver_id).status_code == 200
    data = driver.get(url)
    assert data.status_code == 200, data.text
    assert data.headers["content-type"].startswith("text/calendar")
    assert data.headers["content-disposition"] == 'attachment; filename="mashina-renewal.ics"'
    assert data.headers["cache-control"] == "no-store"
    assert data.text.count("BEGIN:VEVENT") == 1
    assert f"DTSTART;VALUE=DATE:{expires:%Y%m%d}\r\n" in data.text
    assert f"UID:{record['id']}@mashina\r\n" in client.get(url).text
    assert "Hidden garage name" not in data.text and "Private renewal note" not in data.text
    assert "123.45" not in data.text
    assert client.delete(f"/api/v1/vehicles/{car['id']}/access/{driver_id}").status_code == 200
    assert driver.get(url).status_code == 403
    assert mutate(
        client, "event", {}, action="delete", id=record["id"], expected_version=1
    ).status_code == 200
    assert client.get(url).status_code == 404
