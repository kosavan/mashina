from uuid import uuid4

from backend.tests.test_api import mutate


def test_garage_supplies_and_trip_link_existing_expenses(client):
    car = mutate(client, "vehicle", {"name": "Travel car"}).json()["record"]
    service = mutate(client, "event", {
        "kind": "maintenance", "vehicle_id": car["id"], "occurred_at": "2025-04-23",
        "amount": "124.55", "currency": "EUR"
    }).json()["record"]
    other = mutate(client, "vehicle", {"name": "Other car"}).json()["record"]
    foreign = mutate(client, "event", {
        "kind": "expense", "vehicle_id": other["id"], "occurred_at": "2025-04-23",
        "amount": "12.55", "currency": "EUR"
    }).json()["record"]
    item = {
        "id": str(uuid4()), "name": "Engine oil", "part_number": "FILTER-A",
        "unit": "L", "shopping": True, "stock": "4.500",
        "uses": [{"event_id": service["id"], "quantity": "3.250"}],
    }
    trip = {
        "id": str(uuid4()), "name": "Weekend", "start": "2025-04-22",
        "end": "2025-04-25", "people": 2, "event_ids": [service["id"]],
    }
    details = {"supplies": [item], "trips": [trip]}
    result = mutate(client, "vehicle", {"garage_details": details}, action="update", id=car["id"], expected_version=car["version"])
    assert result.status_code == 200, result.text
    saved = result.json()["record"]
    assert saved["garage_details"] == details
    assert len(client.get("/api/v1/state").json()["events"]) == 2
    item["stock"] = "2"
    rejected = mutate(client, "vehicle", {"garage_details": details}, action="update", id=car["id"], expected_version=saved["version"])
    assert rejected.status_code == 422
    item["stock"] = "4.500"
    trip["event_ids"] = [foreign["id"]]
    forbidden = mutate(client, "vehicle", {"garage_details": details}, action="update", id=car["id"], expected_version=saved["version"])
    assert forbidden.status_code == 422
    old_edit = mutate(client, "vehicle", {"name": "Renamed"}, action="update", id=car["id"], expected_version=saved["version"])
    assert old_edit.json()["record"]["garage_details"] == saved["garage_details"]


def test_vin_lookup_is_explicit_and_keeps_saved_fields(client, monkeypatch):
    calls = []
    def lookup(vin, year):
        calls.append((vin, year))
        return {"fields": {"brand": "Proposed", "model": "Example"}, "partial": True}
    monkeypatch.setattr("backend.vin_lookup.lookup", lookup)
    car = mutate(client, "vehicle", {"name": "VIN test", "vin": "5UXWX7C50BA123456", "brand": "Saved"}).json()["record"]
    assert calls == []
    endpoint = f"/api/v1/vehicles/{car['id']}/decode-vin"
    assert client.post(endpoint, json={"expected_version": car["version"] + 1}).status_code == 409
    assert calls == []
    decoded = client.post(endpoint, json={"expected_version": car["version"]})
    assert decoded.status_code == 200, decoded.text
    assert decoded.json()["fields"]["brand"] == "Proposed"
    assert calls == [("5UXWX7C50BA123456", None)]
    found = next(row for row in client.get("/api/v1/state").json()["vehicles"] if row["id"] == car["id"])
    assert found["brand"] == "Saved"
