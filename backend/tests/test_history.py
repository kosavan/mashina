import io
import uuid
from PIL import Image
from fastapi.testclient import TestClient
from backend.tests.test_api import mutate


def test_correct_high_reading_and_delete_recalculates(client):
    car = mutate(client, "vehicle", {"name": "Car", "purchase_odometer": 1000}).json()["record"]
    event = mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "odometer",
            "occurred_at": "2026-01-01",
            "odometer": 9000,
        },
    ).json()["record"]
    result = mutate(
        client, "event", {"odometer": 2000}, id=event["id"], action="update", expected_version=1
    )
    assert result.status_code == 200, result.text
    assert client.get("/api/v1/state").json()["vehicles"][0]["current_odometer"] == 2000
    assert (
        mutate(client, "event", {}, id=event["id"], action="delete", expected_version=2).status_code
        == 200
    )
    assert client.get("/api/v1/state").json()["vehicles"][0]["current_odometer"] == 1000


def test_reminder_repeats_from_confirmed_completion(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    reminder = mutate(
        client,
        "reminder",
        {
            "vehicle_id": car["id"],
            "title": "Oil",
            "due_date": "2026-01-01",
            "due_odometer": 10000,
            "repeat_days": 30,
            "repeat_km": 1000,
        },
    ).json()["record"]
    response = mutate(
        client,
        "reminder",
        {"completion_date": "2026-02-01", "completion_odometer": 11000},
        id=reminder["id"],
        action="complete",
        expected_version=1,
    )
    assert response.status_code == 200, response.text
    assert response.json()["record"]["due_date"] == "2026-03-03"
    assert response.json()["record"]["due_odometer"] == 12000


def test_private_files_and_photo_removal(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    image = io.BytesIO()
    Image.new("RGB", (10, 10)).save(image, format="PNG")
    uploaded = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car["id"], "title": "Cover"},
        files={"file": ("photo.png", image.getvalue(), "image/png")},
    )
    assert uploaded.status_code == 200
    attachment = uploaded.json()["id"]
    assert TestClient(client.app).get(f"/api/v1/attachments/{attachment}").status_code == 401
    assert (
        mutate(
            client,
            "vehicle",
            {"photo_id": attachment},
            id=car["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/attachments/{attachment}").status_code == 200
    assert client.get("/api/v1/state").json()["vehicles"][0]["photo_id"] == ""
    assert client.get(f"/api/v1/attachments/{attachment}").status_code == 403
    assert (
        mutate(
            client,
            "event",
            {
                "vehicle_id": str(uuid.uuid4()),
                "kind": "expense",
                "amount": "1",
                "occurred_at": "2026-01-01",
            },
        ).status_code
        == 403
    )


def test_malformed_item_shape_is_validation_error(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]
    assert (
        mutate(
            client,
            "event",
            {
                "vehicle_id": car["id"],
                "kind": "expense",
                "occurred_at": "2026-01-01",
                "items": "invalid",
            },
        ).status_code
        == 422
    )
