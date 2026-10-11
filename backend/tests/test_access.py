"""Contract tests for local accounts and vehicle-scoped authorization."""

import uuid
from fastapi.testclient import TestClient
from backend.tests.test_api import mutate


def account(owner, name):
    response = owner.post(
        "/api/v1/users", json={"username": name, "password": "test-only-password"}
    )
    assert response.status_code == 200, response.text
    client = TestClient(owner.app)
    login = client.post("/api/v1/login", json={"username": name, "password": "test-only-password"})
    assert login.status_code == 200, login.text
    client.headers["X-CSRF-Token"] = login.json()["csrf"]
    return client, response.json()["id"]


def grant(owner, car, user, role="driver"):
    return owner.put(f"/api/v1/vehicles/{car}/access/{user}", json={"role": role})


def event_data(car, amount="100.01"):
    return {"vehicle_id": car, "kind": "expense", "amount": amount, "occurred_at": "2026-10-01"}


def upload(client, car, event=""):
    return client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car, "event_id": event, "title": "Private receipt"},
        files={"file": ("receipt.pdf", b"%PDF-1.4 test document", "application/pdf")},
    )


def test_driver_scope_authorship_and_financial_aggregation(client):
    driver, user = account(client, "driver")
    car = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    hidden = mutate(client, "vehicle", {"name": "Private"}).json()["record"]["id"]
    foreign = mutate(client, "event", event_data(car)).json()["record"]
    assert driver.get("/api/v1/state").json()["vehicles"] == []
    assert grant(client, car, user).status_code == 200
    state = driver.get("/api/v1/state").json()
    assert [v["id"] for v in state["vehicles"]] == [car]
    assert state["vehicles"][0]["role"] == "driver"
    assert not state["events"][0]["can_edit"]
    assert driver.get("/api/v1/analytics", params={"vehicle_id": hidden}).status_code == 403
    assert (
        mutate(
            driver, "vehicle", {"name": "Attack"}, id=car, action="update", expected_version=1
        ).status_code
        == 403
    )
    assert (
        mutate(
            driver, "event", {"amount": "1"}, id=foreign["id"], action="update", expected_version=1
        ).status_code
        == 403
    )
    created = mutate(driver, "event", {**event_data(car), "created_by": "spoof", "owner_id": user})
    assert created.status_code == 200, created.text
    own = created.json()["record"]
    assert own["created_by"] == user and own["can_edit"]
    assert (
        mutate(
            driver, "event", {"amount": "200.02"}, id=own["id"], action="update", expected_version=1
        ).status_code
        == 200
    )
    assert client.get("/api/v1/analytics").json()["total_minor"] == 30003
    assert driver.get("/api/v1/analytics").json()["total_minor"] == 30003
    assert (
        driver.get("/api/v1/ownership", params={"vehicle_id": car, "month": "2026-10"}).status_code
        == 403
    )
    assert (
        mutate(
            driver, "budget", {"vehicle_id": car, "month": "2026-10", "amount": "1000"}
        ).status_code
        == 403
    )
    assert grant(driver, car, user, "owner").status_code == 403
    assert driver.get("/api/v1/backup").status_code == 403
    assert (
        driver.post(
            "/api/v1/users", json={"username": "attack", "password": "test-only-password"}
        ).status_code
        == 403
    )


def test_revoked_receipt_cannot_replay_and_delegated_owner(client):
    driver, user = account(client, "driver")
    car = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    assert grant(client, car, user, "owner").status_code == 200
    assert (
        mutate(
            driver, "vehicle", {"name": "Changed"}, id=car, action="update", expected_version=1
        ).status_code
        == 200
    )
    payload = {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "event",
        "action": "create",
        "data": event_data(car),
    }
    first = driver.post("/api/v1/mutate", json=payload)
    assert first.status_code == 200, first.text
    assert driver.post("/api/v1/mutate", json=payload).json() == first.json()
    assert client.delete(f"/api/v1/vehicles/{car}/access/{user}").status_code == 200
    assert driver.post("/api/v1/mutate", json=payload).status_code == 403
    assert driver.get("/api/v1/state").json()["vehicles"] == []
    assert client.get("/api/v1/state").json()["vehicles"][0]["name"] == "Changed"


def test_attachment_visibility_and_own_upload(client):
    driver, user = account(client, "driver")
    car = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    grant(client, car, user)
    private = upload(client, car).json()["id"]
    assert driver.get("/api/v1/attachments/" + private).status_code == 403
    assert driver.get("/api/v1/state").json()["attachments"] == []
    assert (
        client.patch("/api/v1/attachments/" + private, json={"visibility": "shared"}).status_code
        == 200
    )
    assert driver.get("/api/v1/attachments/" + private).status_code == 200
    assert driver.delete("/api/v1/attachments/" + private).status_code == 403
    assert upload(driver, car).status_code == 403
    own_event = mutate(driver, "event", event_data(car)).json()["record"]["id"]
    own_file = upload(driver, car, own_event)
    assert own_file.status_code == 200, own_file.text
    file_id = own_file.json()["id"]
    assert (
        driver.patch("/api/v1/attachments/" + file_id, json={"visibility": "shared"}).status_code
        == 403
    )
    assert driver.get("/api/v1/attachments/" + file_id).status_code == 200
    assert client.get("/api/v1/attachments/" + file_id).status_code == 200
    assert client.delete(f"/api/v1/vehicles/{car}/access/{user}").status_code == 200
    assert driver.get("/api/v1/attachments/" + file_id).status_code == 403


def test_account_disable_password_and_multicount_restore(client):
    driver, user = account(client, "driver")
    old = TestClient(client.app)
    result = old.post(
        "/api/v1/login", json={"username": "driver", "password": "test-only-password"}
    )
    assert result.status_code == 200
    changed = driver.post(
        "/api/v1/password",
        json={"current_password": "test-only-password", "password": "different-test-password"},
    )
    assert changed.status_code == 200, changed.text
    driver.headers["X-CSRF-Token"] = changed.json()["csrf"]
    assert old.get("/api/v1/state").status_code == 401
    assert driver.get("/api/v1/state").status_code == 200
    car = mutate(client, "vehicle", {"name": "Restored shared"}).json()["record"]["id"]
    assert grant(client, car, user).status_code == 200
    record = mutate(driver, "event", event_data(car)).json()["record"]
    attachment = upload(driver, car, record["id"]).json()["id"]
    archive = client.get("/api/v1/backup")
    assert archive.status_code == 200
    assert client.patch("/api/v1/users/" + user, json={"disabled": True}).status_code == 200
    assert driver.get("/api/v1/state").status_code == 401
    restored = client.post(
        "/api/v1/restore", files={"file": ("backup.zip", archive.content, "application/zip")}
    )
    assert restored.status_code == 200, restored.text
    assert client.get("/api/v1/state").status_code == 401
    restored_login = driver.post(
        "/api/v1/login", json={"username": "driver", "password": "different-test-password"}
    )
    assert restored_login.status_code == 200
    state = driver.get("/api/v1/state").json()
    assert state["vehicles"][0]["role"] == "driver"
    assert state["events"][0]["created_by"] == user
    assert driver.get("/api/v1/attachments/" + attachment).content == b"%PDF-1.4 test document"


def test_upload_rechecks_permission_after_async_read(client, monkeypatch):
    from starlette.datastructures import UploadFile

    driver, user = account(client, "race-driver")
    car = mutate(client, "vehicle", {"name": "Race"}).json()["record"]["id"]
    grant(client, car, user)
    record = mutate(driver, "event", event_data(car)).json()["record"]["id"]
    original_read = UploadFile.read

    async def revoke_on_read(file, size=-1):
        blob = await original_read(file, size)
        with client.app.state.store.transaction() as connection:
            connection.exec_driver_sql(
                "DELETE FROM vehicle_access WHERE vehicle_id=? AND user_id=?", (car, user)
            )
        return blob

    monkeypatch.setattr(UploadFile, "read", revoke_on_read)
    assert upload(driver, car, record).status_code == 403
    assert client.app.state.store.query("SELECT id FROM attachments") == []
    assert list(client.app.state.store.uploads.iterdir()) == []


def test_identity_spoof_transfer_cover_and_scoped_exports(client):
    driver, user = account(client, "scope-driver")
    car = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    hidden = mutate(client, "vehicle", {"name": "Never visible"}).json()["record"]["id"]
    grant(client, car, user)
    event = mutate(driver, "event", event_data(car)).json()["record"]
    assert (
        mutate(
            driver,
            "event",
            {"vehicle_id": hidden},
            id=event["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 403
    )
    assert mutate(driver, "event", event_data(hidden)).status_code == 403
    own_car = mutate(driver, "vehicle", {"name": "Driver-owned"}).json()["record"]["id"]
    assert (
        mutate(
            driver,
            "event",
            {"vehicle_id": own_car},
            id=event["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 422
    )
    scoped = driver.get("/api/v1/export.json").json()
    assert {v["id"] for v in scoped["vehicles"]} == {car, own_car}
    assert "Never visible" not in driver.get("/api/v1/export.csv").text
    assert client.get("/api/v1/session").json()["is_admin"]
    assert not driver.get("/api/v1/session").json()["is_admin"]
    assert (
        client.patch(
            "/api/v1/users/" + client.get("/api/v1/session").json()["id"], json={"disabled": True}
        ).status_code
        == 422
    )


def test_cover_is_shared_and_private_upload_stays_author_scoped(client):
    import io
    from PIL import Image

    driver, user = account(client, "cover-driver")
    other, second = account(client, "second-driver")
    car = mutate(client, "vehicle", {"name": "Cover"}).json()["record"]
    grant(client, car["id"], user)
    grant(client, car["id"], second)
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), "gray").save(buffer, format="PNG")
    photo = client.post(
        "/api/v1/attachments",
        data={"vehicle_id": car["id"]},
        files={"file": ("car.png", buffer.getvalue(), "image/png")},
    ).json()["id"]
    assert driver.get("/api/v1/attachments/" + photo).status_code == 403
    assert (
        mutate(
            client,
            "vehicle",
            {"photo_id": photo},
            id=car["id"],
            action="update",
            expected_version=1,
        ).status_code
        == 200
    )
    assert driver.get("/api/v1/attachments/" + photo).status_code == 200
    assert driver.delete("/api/v1/attachments/" + photo).status_code == 403
    assert (
        client.patch("/api/v1/attachments/" + photo, json={"visibility": "owner"}).status_code
        == 422
    )
    record = mutate(driver, "event", event_data(car["id"])).json()["record"]
    private = upload(driver, car["id"], record["id"]).json()["id"]
    assert other.get("/api/v1/attachments/" + private).status_code == 403
    assert (
        other.patch("/api/v1/attachments/" + private, json={"notes": "attack"}).status_code == 403
    )
    assert (
        driver.patch("/api/v1/attachments/" + private, json={"notes": "author note"}).status_code
        == 200
    )
    assert client.get("/api/v1/analytics").json()["total_minor"] == 10001
    assert driver.get("/api/v1/analytics").json()["total_minor"] == 10001
    assert other.get("/api/v1/analytics").json()["total_minor"] == 10001
