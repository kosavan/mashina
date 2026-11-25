import json

from backend.tests.test_api import mutate


def test_mapped_fuel_csv_preserves_details_and_retries_exactly_once(client):
    car = mutate(client, "vehicle", {"name": "UK import", "currency": "GBP"}).json()["record"]
    blob = (
        "ID;Date;Litres;Cost;Currency;Full tank;Fuel type;Fuel station;Category;Odometer\n"
        "fill-1;04/01/2026;40,5;58,32;;yes;Petrol;Test station;Premium petrol;120000\n"
        "fill-2;05/01/2026;20;36;€;no;Petrol;Test station;Travel;120250\n"
    ).encode()
    files = {"file": ("fill-ups.csv", blob, "text/csv")}
    data = {"vehicle_id": car["id"]}
    inspected = client.post("/api/v1/import/csv/inspect", files=files, data=data)
    assert inspected.status_code == 200, inspected.text
    options = inspected.json()
    assert options.pop("row_count") == 2
    assert options.pop("headers")[1] == "Date"
    assert options["default_currency"] == "GBP"
    assert options["default_kind"] == "fuel"
    assert options["date_format"] == "dmy"
    preview_endpoint = "/api/v1/import/csv/preview"
    data["mapping"] = json.dumps(options)
    response = client.post(preview_endpoint, files=files, data=data)
    assert response.status_code == 200, response.text
    first, second = response.json()["rows"]
    assert not first.get("error") and not second.get("error"), (first, second)
    assert first["data"]["occurred_at"].startswith("2026-01-04")
    assert first["data"]["amount_minor"] == 5832
    assert first["data"]["currency"] == "GBP"
    assert first["data"]["full"] is True
    assert first["data"]["category"] == "Premium petrol"
    assert first["data"]["station"] == "Test station"
    assert second["data"]["currency"] == "EUR"

    payload = {
        "vehicle_id": car["id"],
        "rows": [first["source"], second["source"]],
        "default_currency": "GBP",
        "confirm_odometer": True,
    }
    endpoint = "/api/v1/import/csv/commit"
    created = client.post(endpoint, json=payload)
    assert created.status_code == 200, created.text
    retried = client.post(endpoint, json={**payload, "default_currency": "USD"})
    assert retried.json() == created.json()
    assert len(client.get("/api/v1/state").json()["events"]) == 2
    repeat = client.post(preview_endpoint, files=files, data=data)
    assert all(row["duplicate"] for row in repeat.json()["rows"])

    options["columns"]["category"] = "Cost"
    data["mapping"] = json.dumps(options)
    invalid = client.post(preview_endpoint, files=files, data=data)
    assert invalid.status_code == 422
