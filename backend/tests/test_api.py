import uuid
from fastapi.testclient import TestClient


def mutate(c, entity, data, **kwargs):
    return c.post(
        "/api/v1/mutate",
        json={
            "operation_id": str(uuid.uuid4()),
            "entity": entity,
            "action": "create",
            "id": str(uuid.uuid4()),
            "data": data,
            **kwargs,
        },
    )


def test_setup_csrf_and_unauthorized(client):
    assert (
        client.post(
            "/api/v1/setup",
            json={
                "username": "other",
                "password": "test-only-password",
                "bootstrap_token": "test-bootstrap",
            },
        ).status_code
        == 409
    )
    assert TestClient(client.app).get("/api/v1/state").status_code == 401
    old = client.headers.pop("X-CSRF-Token")
    assert mutate(client, "vehicle", {"name": "Car"}).status_code == 403
    client.headers["X-CSRF-Token"] = old
    assert (
        client.post(
            "/api/v1/mutate", headers={"Origin": "https://evil.example"}, json={}
        ).status_code
        == 403
    )


def test_two_cars_events_idempotency_and_undo(client):
    car = mutate(client, "vehicle", {"name": "Volvo", "purchase_odometer": 100000}).json()["record"]
    assert mutate(client, "vehicle", {"name": "BMW"}).status_code == 200
    payload = {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "event",
        "action": "create",
        "data": {
            "vehicle_id": car["id"],
            "kind": "expense",
            "amount": "1000.01",
            "occurred_at": "2026-01-01",
            "odometer": 101000,
        },
    }
    a = client.post("/api/v1/mutate", json=payload)
    assert a.status_code == 200, a.text
    assert client.post("/api/v1/mutate", json=payload).json() == a.json()
    payload["data"]["amount"] = "1"
    assert client.post("/api/v1/mutate", json=payload).status_code == 409
    assert len(client.get("/api/v1/state").json()["events"]) == 1
    event = a.json()["record"]
    assert (
        mutate(client, "event", {}, action="delete", id=event["id"], expected_version=1).status_code
        == 200
    )
    assert client.get("/api/v1/analytics").json()["total_minor"] == 0
    assert (
        mutate(
            client, "event", {}, action="restore", id=event["id"], expected_version=2
        ).status_code
        == 200
    )
    assert client.get("/api/v1/analytics").json()["total_minor"] == 100001
    assert (
        mutate(
            client,
            "event",
            {"description": "stale"},
            action="update",
            id=event["id"],
            expected_version=1,
        ).status_code
        == 409
    )


def test_mileage_confirmation_and_historical(client):
    car = mutate(
        client, "vehicle", {"name": "Car", "purchase_odometer": 1000, "purchase_date": "2026-01-01"}
    ).json()["record"]
    assert (
        mutate(
            client,
            "event",
            {
                "vehicle_id": car["id"],
                "kind": "odometer",
                "occurred_at": "2026-02-01",
                "odometer": 2000,
            },
        ).status_code
        == 200
    )
    assert (
        mutate(
            client,
            "event",
            {
                "vehicle_id": car["id"],
                "kind": "odometer",
                "occurred_at": "2026-03-01",
                "odometer": 1500,
            },
        ).status_code
        == 422
    )
    assert (
        mutate(
            client,
            "event",
            {
                "vehicle_id": car["id"],
                "kind": "odometer",
                "occurred_at": "2026-01-15",
                "odometer": 1500,
            },
        ).status_code
        == 200
    )
    assert client.get("/api/v1/state").json()["vehicles"][0]["current_odometer"] == 2000
