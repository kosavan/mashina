import csv
import io
import json

import pytest
from pypdf import PdfReader

from backend.output_locale import number, user_locale
from backend.tests.test_api import mutate


@pytest.mark.parametrize("locale,heading,amount,stamp", [
    ("ru", "ИСТОРИЯ АВТОМОБИЛЯ", "1 234,56", "01.02.2026"),
    ("en", "VEHICLE HISTORY", "1,234.56", "01/02/2026"),
    ("de", "FAHRZEUGHISTORIE", "1.234,56", "01.02.2026"),
])
def test_localized_pdf_readable_csv_and_unchanged_machine_exports(client, locale, heading, amount, stamp):
    car = mutate(client, "vehicle", {"name": "Топливо", "brand": "My Custom Make"}).json()["record"]
    event = mutate(client, "event", {
        "vehicle_id": car["id"], "kind": "maintenance", "occurred_at": "2026-02-01",
        "amount": "1234.56", "description": "Двигатель", "category": "Моя категория",
    }).json()["record"]
    mutate(client, "settings", {"locale": locale})
    response = client.post(f"/api/v1/vehicles/{car['id']}/sale-report",
                           json={"include_costs": True, "include_descriptions": True})
    assert response.status_code == 200
    text = "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages)
    assert heading in text and amount in text and stamp in text
    assert "Топливо" in text and "Двигатель" in text  # user-owned values equal to system labels
    rows = list(csv.reader(io.StringIO(client.get("/api/v1/export.csv?readable=true").content.decode("utf-8-sig"))))
    assert rows[1][0] == stamp
    assert rows[1][1] == "Топливо" and rows[1][4] == "Двигатель"
    assert rows[1][5] == amount
    legacy = list(csv.reader(io.StringIO(client.get("/api/v1/export.csv").content.decode("utf-8-sig"))))
    assert legacy[0] == ["entity", "id", "vehicle_id", "event_id", "data_json"]
    exported = next(json.loads(row[4]) for row in legacy[1:] if row[1] == event["id"])
    assert exported["amount_minor"] == 123456 and exported["description"] == "Двигатель"
    assert client.get("/api/v1/export.json").json()["events"][0]["id"] == event["id"]


def test_readable_csv_escapes_formula_text_without_mutating_records(client):
    car = mutate(client, "vehicle", {"name": "=1+1"}).json()["record"]
    mutate(client, "event", {"vehicle_id": car["id"], "kind": "note", "occurred_at": "2026-01-01", "description": "@SUM(1)"})
    rows = list(csv.reader(io.StringIO(client.get("/api/v1/export.csv?readable=true").content.decode("utf-8-sig"))))
    assert rows[1][1] == "'=1+1" and rows[1][4] == "'@SUM(1)"
    assert client.get("/api/v1/state").json()["vehicles"][0]["name"] == "=1+1"


def test_output_fallback_and_exact_number(client):
    from decimal import Decimal
    mutate(client, "settings", {"locale": "zh"})
    store = client.app.state.store
    actor = store.query("SELECT id FROM users")[0]["id"]
    assert user_locale(store, actor) == "en"
    assert number(Decimal("9999999999.99"), "en", 2) == "9,999,999,999.99"


@pytest.mark.parametrize("locale,expected", [("ru", "Есть напоминание"), ("en", "A service reminder"), ("de", "Eine Wartungserinnerung")])
def test_generic_notification_payload_is_localized_without_private_details(monkeypatch, locale, expected):
    from backend import notification_transport as transport
    captured = []
    monkeypatch.setattr(transport, "telegram_request", lambda token, method, payload: (captured.append(payload) or (200, {}, b'{"ok":true}')))
    assert transport.send_telegram("unused", "123", locale).state == "accepted"
    assert expected in captured[0]["text"]
    assert "123" not in captured[0]["text"]


def test_dispatch_resolves_locale_for_current_recipient(client, monkeypatch):
    from backend.notification_delivery import provider_transport
    from backend import notification_delivery as delivery
    captured = []
    monkeypatch.setattr(delivery, "send_push", lambda destination, private_key, locale: captured.append(locale))
    provider_transport("push", "{}", {"private_key": "not-a-key", "locale": "de"})
    assert captured == ["de"]
