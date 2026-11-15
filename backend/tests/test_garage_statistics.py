from fastapi.testclient import TestClient

from backend.tests.test_access import account, grant
from backend.tests.test_api import mutate


def test_garage_statistics_use_confirmed_distance_and_keep_currencies_separate(client):
    path = "/api/v1/garage-statistics"
    assert TestClient(client.app).get(path).status_code == 401
    settings = {"distance_unit": "mi", "consumption_unit": "l_100mi", "currency": "GBP"}
    assert mutate(client, "settings", settings).status_code == 200
    shared = mutate(
        client, "vehicle", {"name": "Shared", "purchase_odometer": 1000, "currency": "GBP"}
    ).json()["record"]["id"]
    private = mutate(client, "vehicle", {"name": "Private"}).json()["record"]["id"]
    for day, odometer in [(1, 1100), (2, 1200)]:
        fill = mutate(
            client,
            "event",
            {
                "vehicle_id": shared,
                "kind": "fuel",
                "fuel": "Diesel",
                "occurred_at": f"2026-01-0{day}",
                "odometer": odometer,
                "full": True,
                "liters": "10",
                "amount": "20.25",
                "currency": "USD",
            },
        )
        assert fill.status_code == 200, fill.text
    expense = mutate(
        client,
        "event",
        {
            "vehicle_id": shared,
            "kind": "maintenance",
            "occurred_at": "2026-01-03",
            "odometer": 1300,
            "amount": "120.03",
            "currency": "GBP",
        },
    ).json()["record"]

    report = client.get(path).json()
    assert report["distance_unit"] == "mi"
    assert report["consumption_unit"] == "l_100mi"
    assert report["vehicles"][shared] == {
        "expenses": [
            {"currency": "GBP", "total_minor": 12003, "cost_per_distance": 0.4},
            {"currency": "USD", "total_minor": 4050, "cost_per_distance": 0.14},
        ],
        "consumption": 10,
    }
    assert report["vehicles"][private] == {
        "expenses": [{"currency": "GBP", "total_minor": 0, "cost_per_distance": None}],
        "consumption": None,
    }
    analytics = client.get(
        "/api/v1/analytics", params={"vehicle_id": shared, "currency": "USD"}
    ).json()
    assert (analytics["total_minor"], analytics["cost_per_km"], analytics["consumption"]) == (
        4050,
        0.14,
        10,
    )

    assert mutate(
        client, "event", {}, id=expense["id"], expected_version=1, action="delete"
    ).status_code == 200
    assert client.get(path).json()["vehicles"][shared]["expenses"] == [
        {"currency": "USD", "total_minor": 4050, "cost_per_distance": 0.2}
    ]
    assert mutate(
        client, "event", {}, id=expense["id"], expected_version=2, action="restore"
    ).status_code == 200
    assert client.get(path).json() == report

    driver, driver_id = account(client, "garage-driver")
    assert driver.get(path).json()["vehicles"] == {}
    assert grant(client, shared, driver_id).status_code == 200
    assert set(driver.get(path).json()["vehicles"]) == {shared}
    assert client.delete(f"/api/v1/vehicles/{shared}/access/{driver_id}").status_code == 200
    assert driver.get(path).json()["vehicles"] == {}
