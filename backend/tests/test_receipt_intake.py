import io
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image

from backend.backup import restore_backup
from backend.storage import Denied, Store
from backend.tests.test_access import account, grant
from backend.tests.test_api import mutate


def photo():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color="white").save(buffer, format="PNG")
    return {"file": ("receipt.png", buffer.getvalue(), "image/png")}


def test_receipt_confirmation_is_atomic_private_and_idempotent(client, monkeypatch, tmp_path):
    vehicle_id = mutate(client, "vehicle", {"name": "Wash car"}).json()["record"]["id"]
    other, other_id = account(client, "receipt-driver")
    body = {
        "draft_id": str(uuid4()), "vehicle_id": vehicle_id, "amount": "15.25",
        "occurred_at": "2025-10-12", "currency": "EUR", "category": "Wash",
        "description": "Receipt review",
    }
    url = "/api/v1/receipt-inbox/confirm"
    assert TestClient(client.app).post(url, data=body, files=photo()).status_code == 401
    assert other.post(url, data=body, files=photo()).status_code == 403
    assert grant(client, vehicle_id, other_id).status_code == 200
    with monkeypatch.context() as patch:
        def deny_upload(*args):
            raise Denied("receipt fixture")

        patch.setattr("backend.receipt_inbox.upload_access", deny_upload)
        assert other.post(url, data=body, files=photo()).status_code == 403
    assert not client.get("/api/v1/state").json()["events"]

    result = other.post(url, data=body, files=photo())
    assert result.status_code == 200, result.text
    assert other.post(url, data=body, files=photo()).json() == result.json()
    assert other.post(url, data={**body, "amount": "25"}, files=photo()).status_code == 409
    state = client.get("/api/v1/state").json()
    assert len(state["events"]) == len(state["attachments"]) == 1
    event = state["events"][0]
    attachment = state["attachments"][0]
    assert event["id"] == body["draft_id"] and event["amount_minor"] == 1525
    assert attachment["event_id"] == event["id"] and attachment["visibility"] == "owner"
    downloaded = client.get("/api/v1/attachments/" + attachment["id"])
    assert downloaded.headers["content-type"] == "image/jpeg"

    assert client.delete(f"/api/v1/vehicles/{vehicle_id}/access/{other_id}").status_code == 200
    assert other.post(url, data=body, files=photo()).status_code == 403
    restored = Store(tmp_path / "restored-receipts")
    try:
        restore_backup(restored, client.get("/api/v1/backup").content)
        owner = client.get("/api/v1/session").json()["id"]
        recovered = restored.state(owner)
        assert recovered["events"][0]["amount_minor"] == 1525
        assert recovered["attachments"][0]["event_id"] == event["id"]
        filename = restored.query(
            "SELECT filename FROM attachments WHERE id=?", (attachment["id"],)
        )[0]["filename"]
        assert (restored.uploads / filename).read_bytes() == downloaded.content
    finally:
        restored.close()


def test_import_profiles_are_private_reusable_and_preserved_by_preferences(client, tmp_path):
    endpoint = "/api/v1/import/profiles"
    history = {
        "kind": "history", "name": "Fuel export",
        "mapping": {
            "columns": {"occurred_at": "Booked", "amount": "Total"},
            "default_kind": "fuel", "date_format": "dmy", "default_currency": "GBP",
        },
    }
    bank = {
        "kind": "bank", "name": "Household", "encoding": "cp1251", "delimiter": "tab",
        "mapping": {
            "date": "Day", "amount": "Value", "description": "Memo",
            "date_format": "russian", "outgoing_sign": "negative", "default_currency": "RUB",
        },
    }
    saved = client.post(endpoint, json=history)
    assert saved.status_code == 200, saved.text
    assert client.post(endpoint, json=bank).status_code == 200
    assert mutate(client, "settings", {"locale": "en"}).status_code == 200
    assert client.get(endpoint, params={"kind": "history"}).json() == [saved.json()]
    [bank_profile] = client.get(endpoint, params={"kind": "bank"}).json()
    assert (bank_profile["encoding"], bank_profile["delimiter"]) == ("cp1251", "tab")
    updated = client.post(endpoint, json={**history, "name": "FUEL EXPORT"}).json()
    assert saved.json()["id"] == updated["id"]
    invalid = {**bank, "mapping": {**bank["mapping"], "description": "Value"}}
    assert client.post(endpoint, json=invalid).status_code == 422
    restored = Store(tmp_path / "restored-profiles")
    try:
        restore_backup(restored, client.get("/api/v1/backup").content)
        owner = client.get("/api/v1/session").json()["id"]
        assert updated in restored.state(owner)["settings"]["csv_import_profiles"]
    finally:
        restored.close()

    other, _ = account(client, "profile-user")
    assert other.get(endpoint, params={"kind": "history"}).json() == []
    path = endpoint + "/" + updated["id"]
    assert other.delete(path).status_code == 200
    assert client.get(endpoint, params={"kind": "history"}).json() == [updated]
    assert client.delete(path).status_code == 200
    assert client.get(endpoint, params={"kind": "history"}).json() == []
