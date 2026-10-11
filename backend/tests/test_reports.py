import io
import time
from pypdf import PdfReader
from backend.tests.test_api import mutate
from backend.tests.test_access import account, grant


def pdf_text(response):
    assert response.status_code == 200, response.text[:300]
    assert response.headers["content-type"] == "application/pdf"
    reader = PdfReader(io.BytesIO(response.content))
    return "\n".join(page.extract_text() for page in reader.pages), reader


def report_car(client):
    car = mutate(
        client,
        "vehicle",
        {
            "name": "Ёлка & Volvo",
            "vin": "HIDDENVIN123456789",
            "plate": "А777АА 777",
            "notes": "PRIVATECARSECRET",
            "purchase_minor": 123456789,
            "purchase_odometer": 100000,
            "purchase_date": "2026-01-01",
        },
    ).json()["record"]
    event = mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "maintenance",
            "occurred_at": "2026-02-01",
            "odometer": 101000,
            "description": 'FREETEXTSECRET <img src="https://invalid.example/tracker"/>',
            "vendor": "VENDORSECRET",
            "notes": "NOTESSECRET",
            "items": [
                {
                    "name": "Масляный фильтр Ё",
                    "part_number": "OF-101",
                    "quantity": "2",
                    "unit_price": "100.01",
                    "discount": "0",
                }
            ],
        },
    ).json()["record"]
    return car, event


def test_pdf_defaults_hide_private_fields_and_reject_driver(client):
    car, event = report_car(client)
    hidden = mutate(client, "vehicle", {"name": "OTHER CAR SECRET"}).json()["record"]
    mutate(
        client,
        "event",
        {
            "vehicle_id": hidden["id"],
            "kind": "maintenance",
            "occurred_at": "2026-01-01",
            "description": "OTHER EVENT SECRET",
            "amount": "1",
        },
    )
    response = client.post(f"/api/v1/vehicles/{car['id']}/sale-report", json={})
    text, reader = pdf_text(response)
    assert "Масляный фильтр Ё" in text
    assert "Ёлка & Volvo" in text
    for sentinel in [
        "HIDDENVIN",
        "А777АА",
        "PRIVATECARSECRET",
        "FREETEXTSECRET",
        "VENDORSECRET",
        "NOTESSECRET",
        "OTHER CAR SECRET",
        "OTHER EVENT SECRET",
        "100,01",
        "200,02",
        "1234567,89",
    ]:
        assert sentinel not in text
    assert reader.metadata.author == "MASHINA"
    driver, user = account(client, "pdf-driver")
    grant(client, car["id"], user)
    assert driver.post(f"/api/v1/vehicles/{car['id']}/sale-report", json={}).status_code == 403
    assert "no-store" in response.headers["cache-control"]


def test_pdf_explicit_disclosure_finance_and_markup_are_safe(client):
    car, event = report_car(client)
    mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "expense",
            "occurred_at": "2026-02-02",
            "amount": "50.01",
        },
    )
    mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "expense",
            "occurred_at": "2026-02-03",
            "amount": "10.01",
            "currency": "USD",
        },
    )
    response = client.post(
        f"/api/v1/vehicles/{car['id']}/sale-report",
        json={"include_costs": True, "include_identifiers": True, "include_descriptions": True},
    )
    text, reader = pdf_text(response)
    assert "HIDDENVIN123456789" in text and "А777АА 777" in text
    assert "FREETEXTSECRET" in text and "<img" in text
    assert "250,03" in text and "10,01" in text and "USD" in text
    assert "VENDORSECRET" not in text and "NOTESSECRET" not in text
    assert "1 234 567,89" in text
    assert not any(page.get("/Annots") for page in reader.pages)
    assert (
        client.post(
            f"/api/v1/vehicles/{car['id']}/sale-report",
            json={"start": "2026-03-01", "end": "2026-01-01"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/v1/vehicles/{car['id']}/sale-report", json={"url": "https://invalid.example"}
        ).status_code
        == 422
    )


def test_pdf_period_deleted_rows_and_empty_history(client):
    car, event = report_car(client)
    endpoint = f"/api/v1/vehicles/{car['id']}/sale-report"
    response = client.post(endpoint, json={"start": "2026-03-01", "include_costs": True})
    text, _ = pdf_text(response)
    assert "Масляный фильтр" not in text and "Работы за этот период не записаны" in text
    mutate(client, "event", {}, action="delete", id=event["id"], expected_version=1)
    text, _ = pdf_text(client.post(endpoint, json={}))
    assert "Масляный фильтр" not in text


def test_pdf_long_history_budget_and_hard_limit(client):
    from backend.reports import report_snapshot, render_report, ReportOptions

    car, event = report_car(client)
    store = client.app.state.store
    actor = client.get("/api/v1/session").json()["id"]
    snapshot = report_snapshot(store, actor, car["id"], ReportOptions(include_descriptions=True))
    snapshot.works = [
        {
            **snapshot.works[0],
            "description": ("Длинное название обслуживания Ёжик " * 10),
            "items": [
                {"name": "ОченьДлинныйАртикул" * 15, "part_number": "PART" * 30, "quantity": "1"}
            ],
        }
        for _ in range(200)
    ]
    start = time.perf_counter()
    blob = render_report(snapshot)
    assert time.perf_counter() - start < 3
    assert len(blob) < 5 * 1024 * 1024
    reader = PdfReader(io.BytesIO(blob))
    assert 2 < len(reader.pages) <= 100
    assert "ОченьДлинныйАртикул" in reader.pages[-1].extract_text()
    snapshot.works *= 3
    import pytest

    with pytest.raises(ValueError, match="500"):
        render_report(snapshot)


def test_report_snapshot_matches_ownership_analytics_and_releases_render_lock(client, monkeypatch):
    from backend.domain import analytics
    from backend.reports import ReportOptions, report_snapshot, RENDER_LOCK
    import importlib

    app_module = importlib.import_module("backend.app")

    car, event = report_car(client)
    mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "odometer",
            "occurred_at": "2025-06-01",
            "odometer": 90000,
            "confirm_odometer": True,
        },
    )
    actor = client.get("/api/v1/session").json()["id"]
    store = client.app.state.store
    for start in ("2025-01-01", "2025-12-01", "2026-01-15", "2026-02-10"):
        state = store.state(actor)
        expected = analytics(state["vehicles"], state["events"], start=start)
        snapshot = report_snapshot(store, actor, car["id"], ReportOptions(start=start))
        assert snapshot.mileage == expected["mileage"]
        assert snapshot.mileage in (None, 1000)
    endpoint = f"/api/v1/vehicles/{car['id']}/sale-report"
    with RENDER_LOCK:
        assert client.post(endpoint, json={}).status_code == 429

    def broken(snapshot):
        raise ValueError("Проверка восстановления после ошибки")

    monkeypatch.setattr(app_module, "render_report", broken)
    assert client.post(endpoint, json={}).status_code == 422
    assert RENDER_LOCK.acquire(blocking=False)
    RENDER_LOCK.release()
