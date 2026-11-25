import uuid

import pytest
from fastapi.testclient import TestClient

from backend.backup import restore_backup
from backend.domain import normalize_event
from backend.storage import Store
from backend.tests.test_api import mutate


def test_renewal_expenses_retry_edit_and_restore(client, tmp_path):
    car = mutate(client, "vehicle", {"name": "Renewal car", "currency": "AED"}).json()["record"]
    payload = {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "event",
        "action": "create",
        "data": {
            "vehicle_id": car["id"],
            "kind": "expense",
            "occurred_at": "2025-01-01",
            "amount": "123.45",
            "renewal": {"type": "registration", "expires_on": "2025-12-31"},
        },
    }
    created = client.post("/api/v1/mutate", json=payload)
    assert created.status_code == 200, created.text
    registration = created.json()["record"]
    assert registration["renewal"] == {
        "type": "registration", "expires_on": "2025-12-31", "inspection_status": "pending",
    }
    assert registration["category"] == "Налоги"
    assert registration["currency"] == "AED"
    assert client.post("/api/v1/mutate", json=payload).json() == created.json()

    legacy_edit = mutate(
        client,
        "event",
        {"description": "Preserved renewal details", "amount": "124.05"},
        action="update",
        id=registration["id"],
        expected_version=registration["version"],
    )
    assert legacy_edit.status_code == 200, legacy_edit.text
    assert legacy_edit.json()["record"]["renewal"] == registration["renewal"]
    latest = mutate(
        client,
        "event",
        {"renewal": {**registration["renewal"], "inspection_status": "passed"}},
        action="update",
        id=registration["id"],
        expected_version=legacy_edit.json()["record"]["version"],
    )
    assert latest.status_code == 200, latest.text

    insurance = mutate(
        client,
        "event",
        {
            "vehicle_id": car["id"],
            "kind": "expense",
            "occurred_at": "2025-12-01",
            "amount": "500.01",
            "renewal": {"type": "insurance", "expires_on": "2026-12-01"},
        },
    )
    assert insurance.status_code == 200, insurance.text
    assert insurance.json()["record"]["category"] == "Страхование"
    analytics = client.get("/api/v1/analytics", params={"vehicle_id": car["id"], "currency": "AED"})
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["total_minor"] == 62406

    report = b"%PDF-1.4\ninspection report fixture"
    other = mutate(client, "vehicle", {"name": "Other car"}).json()["record"]
    denied = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": other["id"], "event_id": registration["id"]},
        files={"file": ("inspection.pdf", report, "application/pdf")},
    )
    assert denied.status_code == 403
    attached = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car["id"], "event_id": registration["id"], "title": "Inspection report"},
        files={"file": ("inspection.pdf", report, "application/pdf")},
    )
    assert attached.status_code == 200, attached.text
    aid = attached.json()["id"]
    assert client.get(f"/api/v1/attachments/{aid}").content == report
    assert TestClient(client.app).get(f"/api/v1/attachments/{aid}").status_code == 401

    restored = Store(tmp_path / "restored-renewals")
    try:
        restore_backup(restored, client.get("/api/v1/backup").content)
        owner = restored.query("SELECT id FROM users")[0]["id"]
        state = restored.state(owner)
        assert len(state["events"]) == 2
        renewed = next(event for event in state["events"] if event["id"] == registration["id"])
        assert renewed["renewal"] == latest.json()["record"]["renewal"]
        assert state["attachments"][0]["event_id"] == registration["id"]
        filename = restored.query("SELECT filename FROM attachments WHERE id=?", (aid,))[0]["filename"]
        assert (restored.uploads / filename).read_bytes() == report
    finally:
        restored.close()


@pytest.mark.parametrize(
    ("kind", "renewal"),
    [
        ("maintenance", {"type": "registration", "expires_on": "2026-01-01"}),
        ("expense", {"type": "unknown", "expires_on": "2026-01-01"}),
        ("expense", {"type": "registration", "expires_on": "2024-12-31"}),
        ("expense", {"type": "registration", "expires_on": "2026-02-30"}),
        ("expense", {"type": "registration", "expires_on": "20260101"}),
        ("expense", {"type": "registration", "expires_on": "2026-01-01", "inspection_status": "bad"}),
        ("expense", {"type": "insurance", "expires_on": "2026-01-01", "inspection_status": "passed"}),
    ],
)
def test_renewal_validation(kind, renewal):
    with pytest.raises(ValueError):
        normalize_event({"kind": kind, "occurred_at": "2025-01-01", "renewal": renewal})
