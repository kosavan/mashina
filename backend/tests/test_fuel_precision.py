from uuid import uuid4

from backend.tests.test_api import mutate


def test_fractional_fuel_price_edit_and_replay_keep_exact_total(client):
    car = mutate(client, "vehicle", {"name": "UK history", "currency": "GBP"}).json()["record"]
    data = {
        "vehicle_id": car["id"],
        "kind": "fuel",
        "occurred_at": "2026-01-19",
        "odometer": 1000,
        "liters": "15",
        "price": "1.759",
        "currency": "GBP",
    }
    event = mutate(client, "event", data).json()["record"]
    assert event["price"] == "1.759"
    assert event["amount_minor"] == 2639
    payload = {
        "operation_id": str(uuid4()),
        "entity": "event",
        "action": "update",
        "id": event["id"],
        "expected_version": event["version"],
        "data": {**data, "price": "1.769", "amount": ""},
    }
    result = client.post("/api/v1/mutate", json=payload)
    assert result.status_code == 200, result.text
    assert result.json()["record"]["price"] == "1.769"
    assert result.json()["record"]["amount_minor"] == 2654
    assert client.post("/api/v1/mutate", json=payload).json() == result.json()
    events = client.get("/api/v1/state").json()["events"]
    assert len(events) == 1
    assert events[0]["id"] == event["id"]
    assert events[0]["amount_minor"] == 2654
