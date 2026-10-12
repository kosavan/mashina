"""Synthetic machine credential lifecycle and ownership boundary tests."""

import json
import time
import uuid
import pytest

from fastapi.testclient import TestClient

from backend.tests.test_api import mutate
from backend.tests.test_access import account, grant
from concurrent.futures import ThreadPoolExecutor

MANAGEMENT = "/api/v1/machine/credentials"
MACHINE = "/api/machine/v1"


def issue(client, cars, **options):
    return client.post(
        MANAGEMENT, json={"label": "Локальный клиент", "vehicle_ids": cars, **options}
    )


def machine(client, secret):
    result = TestClient(client.app)
    result.headers["Authorization"] = "Bearer " + secret
    return result


def test_machine_default_off_and_no_cookie_fallback(client):
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    assert client.get(MANAGEMENT).json() == {"enabled": False, "credentials": []}
    assert issue(client, [car]).status_code == 403
    assert client.get(MACHINE + "/vehicles").status_code == 401


def test_machine_secret_once_original_owner_and_revoke(client):
    client.app.state.machine_enabled = True
    car = mutate(
        client, "vehicle", {"name": "Invented", "vin": "PRIVATE_VIN", "plate": "PRIVATE_PLATE"}
    ).json()["record"]["id"]
    second = mutate(client, "vehicle", {"name": "Hidden"}).json()["record"]["id"]
    delegated, user = account(client, "delegated")
    assert grant(client, car, user, "owner").status_code == 200
    assert issue(delegated, [car]).status_code == 403
    assert grant(client, car, user, "driver").status_code == 200
    assert issue(delegated, [car]).status_code == 403
    issued = issue(client, [car])
    assert issued.status_code == 200, issued.text
    key = issued.json()
    secret = key["secret"]
    assert len(secret) >= 43
    listed = client.get(MANAGEMENT)
    assert secret not in listed.text and "token_hash" not in listed.text
    assert listed.json()["credentials"][0]["vehicle_ids"] == [car]
    bearer = machine(client, secret)
    response = bearer.get(MACHINE + "/vehicles")
    assert response.status_code == 200, response.text
    assert [r["id"] for r in response.json()] == [car]
    assert all(
        marker not in response.text for marker in ("PRIVATE_VIN", "PRIVATE_PLATE", "owner_id")
    )
    assert bearer.get(MACHINE + f"/vehicles/{second}/history").status_code == 403
    assert bearer.get("/api/v1/state").status_code == 401
    assert secret not in json.dumps(client.app.state.store.query("SELECT * FROM audit"))
    assert secret not in json.dumps(
        client.app.state.store.query("SELECT * FROM machine_credentials")
    )
    assert delegated.delete(MANAGEMENT + "/" + key["id"]).status_code == 403
    assert client.delete(MANAGEMENT + "/" + key["id"]).status_code == 200
    assert client.delete(MANAGEMENT + "/" + key["id"]).status_code == 200
    assert bearer.get(MACHINE + "/vehicles").status_code == 401


def test_machine_expiry_disable_ownership_password_and_csrf(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    key = issue(client, [car]).json()
    bearer = machine(client, key["secret"])
    store = client.app.state.store
    with store.transaction() as c:
        c.exec_driver_sql(
            "UPDATE machine_credentials SET created=?,expires=?",
            (int(time.time()) - 86400, int(time.time()) - 1),
        )
    assert bearer.get(MACHINE + "/vehicles").status_code == 401
    key = issue(client, [car]).json()
    bearer = machine(client, key["secret"])
    client.app.state.machine_enabled = False
    assert bearer.get(MACHINE + "/vehicles").status_code == 401
    client.app.state.machine_enabled = True
    other, user = account(client, "other")
    with store.transaction() as c:
        c.exec_driver_sql("UPDATE vehicles SET owner_id=? WHERE id=?", (user, car))
    assert bearer.get(MACHINE + f"/vehicles/{car}/history").status_code == 403
    assert bearer.get(MACHINE + "/vehicles").json() == []
    car2 = mutate(client, "vehicle", {"name": "Owned"}).json()["record"]["id"]
    key2 = issue(client, [car2]).json()
    assert (
        client.post(
            "/api/v1/password",
            json={"current_password": "test-only-password", "password": "new-test-only-password"},
        ).status_code
        == 200
    )
    assert machine(client, key2["secret"]).get(MACHINE + "/vehicles").status_code == 401
    other.headers.pop("X-CSRF-Token")
    assert issue(other, [car]).status_code == 403


def test_machine_limits_unknown_fields_and_demo(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    for opts in (
        {"expires_days": 0},
        {"expires_days": 366},
        {"label": " "},
        {"user_id": str(uuid.uuid4())},
    ):
        assert issue(client, [car], **opts).status_code == 422
    assert issue(client, [car, car]).status_code == 422
    assert issue(client, []).status_code == 422
    for _ in range(10):
        assert issue(client, [car]).status_code == 200
    assert issue(client, [car]).status_code == 409
    demo = TestClient(client.app)
    session = demo.post("/api/v1/demo").json()
    demo.headers["X-CSRF-Token"] = session["csrf"]
    demo_car = demo.get("/api/v1/state").json()["vehicles"][0]["id"]
    assert demo.get(MANAGEMENT).json() == {"enabled": False, "credentials": []}
    assert issue(demo, [demo_car]).status_code == 403


def operation(**changes):
    return {
        "operation_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "entity": "event",
        "action": "upsert",
        "base_version": 0,
        "data": {
            "kind": "expense",
            "amount": "100.01",
            "occurred_at": "2026-10-01",
            "description": "Invented wash",
        },
        **changes,
    }


def test_machine_mutation_exact_retry_namespaces_and_strict_fields(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    readonly = machine(client, issue(client, [car]).json()["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    payload = operation()
    assert readonly.post(endpoint, json=payload).status_code == 403
    bearer = machine(client, issue(client, [car], write_enabled=True).json()["secret"])
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: bearer.post(endpoint, json=payload), range(2)))
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses]
    assert responses[0].json() == responses[1].json()
    assert responses[0].json()["record"]["amount_minor"] == 10001
    assert "created_by" not in responses[0].text
    assert len(client.get("/api/v1/state").json()["events"]) == 1
    assert (
        bearer.post(
            endpoint, json={**payload, "data": {**payload["data"], "amount": "1"}}
        ).status_code
        == 409
    )
    assert (
        bearer.post(
            endpoint, json={**payload, "operation_id": str(uuid.uuid4()), "base_version": 2}
        ).status_code
        == 409
    )
    other_key = machine(client, issue(client, [car], write_enabled=True).json()["secret"])
    other_payload = {**payload, "id": str(uuid.uuid4())}
    assert other_key.post(endpoint, json=other_payload).status_code == 200
    assert bearer.get(MACHINE + f"/vehicles/{car}/analytics").json()["total_minor"] == 20002
    for malicious in (
        {"owner_id": str(uuid.uuid4())},
        {"odometer_confirmed": True},
        {"bank_transaction_id": "private"},
        {"items": [{"name": "Part", "unit_price": "1", "owner_id": "spoof"}]},
    ):
        assert (
            bearer.post(endpoint, json=operation(data={**payload["data"], **malicious})).status_code
            == 422
        )
    assert len(client.get("/api/v1/state").json()["events"]) == 2
    update = operation(id=payload["id"], base_version=1, data={"amount": "1.23"})
    assert bearer.post(endpoint, json=update).json()["record"]["amount_minor"] == 123
    delete = operation(id=payload["id"], action="delete", base_version=2, data={})
    assert bearer.post(endpoint, json=delete).json()["record"]["deleted"]
    assert bearer.get(MACHINE + f"/vehicles/{car}/analytics").json()["total_minor"] == 10001


def test_machine_history_pagination_literal_search_and_private_projection(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    for i in range(4):
        mutate(
            client,
            "event",
            {
                "vehicle_id": car,
                "kind": "expense",
                "amount": "1",
                "occurred_at": f"2026-10-0{i + 1}",
                "description": "100% clean" if i == 2 else "ordinary",
                "private_extension": "HIDDEN_MARKER",
            },
        )
    bearer = machine(client, issue(client, [car]).json()["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/history"
    first = bearer.get(endpoint, params={"limit": 2})
    assert first.status_code == 200, first.text
    assert "HIDDEN_MARKER" not in first.text and "created_by" not in first.text
    page = first.json()
    second = bearer.get(endpoint, params={"limit": 2, "cursor": page["next_cursor"]}).json()
    assert len({e["id"] for e in page["items"] + second["items"]}) == 4
    assert second["next_cursor"] is None
    assert bearer.get(endpoint, params={"limit": 101}).status_code == 422
    assert bearer.get(endpoint, params={"search": "x" * 201}).status_code == 422
    assert (
        bearer.get(endpoint, params={"search": "%"}).json()["items"][0]["description"]
        == "100% clean"
    )
    assert len(bearer.get(endpoint, params={"search": "%"}).json()["items"]) == 1
    assert bearer.get(endpoint, params={"search": "HIDDEN_MARKER"}).json()["items"] == []
    assert (
        bearer.get(endpoint, params={"cursor": page["next_cursor"], "kind": "expense"}).status_code
        == 422
    )
    assert bearer.get(endpoint, params={"cursor": "not-json"}).status_code == 422
    assert (
        bearer.get(endpoint, params={"start": "2026-10-04", "end": "2026-10-01"}).status_code == 422
    )


def test_machine_reminders_admin_disable_reset_and_odometer_confirmation(client):
    client.app.state.machine_enabled = True
    owner, user = account(client, "carowner")
    car = mutate(owner, "vehicle", {"name": "Invented", "purchase_odometer": 1000}).json()[
        "record"
    ]["id"]
    key = issue(owner, [car], write_enabled=True).json()
    bearer = machine(client, key["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    reminder = operation(entity="reminder", data={"title": "Oil", "due_odometer": 2000})
    assert bearer.post(endpoint, json=reminder).status_code == 200
    assert (
        bearer.get(MACHINE + f"/vehicles/{car}/reminders").json()["items"][0]["remaining_km"]
        == 1000
    )
    assert (
        bearer.post(
            endpoint,
            json=operation(data={"kind": "odometer", "odometer": 500, "occurred_at": "2026-10-01"}),
        ).status_code
        == 422
    )
    assert client.patch(f"/api/v1/users/{user}", json={"disabled": True}).status_code == 200
    assert bearer.get(MACHINE + "/vehicles").status_code == 401
    assert client.patch(f"/api/v1/users/{user}", json={"disabled": False}).status_code == 200
    assert bearer.get(MACHINE + "/vehicles").status_code == 401
    login = owner.post(
        "/api/v1/login", json={"username": "carowner", "password": "test-only-password"}
    )
    owner.headers["X-CSRF-Token"] = login.json()["csrf"]
    key = issue(owner, [car]).json()
    assert (
        client.patch(
            f"/api/v1/users/{user}", json={"password": "new-test-only-password"}
        ).status_code
        == 200
    )
    assert machine(client, key["secret"]).get(MACHINE + "/vehicles").status_code == 401


def test_machine_restore_revokes_and_preserves_receipts(client, tmp_path):
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store
    from backend.machine_access import authorize
    from fastapi import HTTPException

    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    key = issue(client, [car], write_enabled=True).json()
    bearer = machine(client, key["secret"])
    assert bearer.post(MACHINE + f"/vehicles/{car}/mutations", json=operation()).status_code == 200
    archive = make_backup(client.app.state.store)
    assert key["secret"].encode() not in archive
    restored = Store(tmp_path / "restored")
    restore_backup(restored, archive)
    assert len(restored.query("SELECT * FROM machine_receipts")) == 1
    assert restored.query("SELECT revoked FROM machine_credentials")[0]["revoked"] is not None
    with restored.transaction() as c, pytest.raises(HTTPException):
        authorize(c, "Bearer " + key["secret"], True)
    restored.close()
    contract = bearer.get(MACHINE + "/openapi.json")
    assert contract.status_code == 200, contract.text
    assert all(path.startswith(MACHINE + "/") for path in contract.json()["paths"])
    assert contract.json()["security"] == [{"MachineBearer": []}]


def test_machine_period_preserves_fuel_boundary_and_historical_edits(client):
    client.app.state.machine_enabled = True
    car = mutate(
        client,
        "vehicle",
        {"name": "Invented", "purchase_date": "2026-09-01", "purchase_odometer": 1000},
    ).json()["record"]["id"]
    for day, km, liters in (("2026-09-28", 1000, "40"), ("2026-10-02", 1500, "40")):
        mutate(
            client,
            "event",
            {
                "vehicle_id": car,
                "kind": "fuel",
                "occurred_at": day,
                "odometer": km,
                "liters": liters,
                "price": "60",
                "full": True,
                "fuel": "АИ-95",
            },
        )
    bearer = machine(client, issue(client, [car]).json()["secret"])
    result = bearer.get(
        MACHINE + f"/vehicles/{car}/analytics", params={"start": "2026-10-01", "end": "2026-10-02"}
    )
    assert result.status_code == 200, result.text
    expected = client.get(
        "/api/v1/analytics", params={"vehicle_id": car, "start": "2026-10-01", "end": "2026-10-02"}
    ).json()
    assert result.json()["consumption"] == expected["consumption"] == 8
    assert result.json()["total_minor"] == 240000
    assert result.json()["mileage"] == 500
    assert all(k not in result.json() for k in ("purchase_minor", "sale_minor", "ownership_minor"))


def test_machine_foreign_write_replay_revocation_and_original_owner(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Allowed"}).json()["record"]["id"]
    foreign = mutate(client, "vehicle", {"name": "Excluded"}).json()["record"]["id"]
    event = mutate(
        client,
        "event",
        {"vehicle_id": foreign, "kind": "expense", "amount": "7", "occurred_at": "2026-10-01"},
    ).json()["record"]
    key = issue(client, [car], write_enabled=True).json()
    bearer = machine(client, key["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    assert (
        bearer.post(
            endpoint, json=operation(id=event["id"], base_version=1, data={"amount": "1"})
        ).status_code
        == 403
    )
    assert (
        bearer.post(MACHINE + f"/vehicles/{foreign}/mutations", json=operation()).status_code == 403
    )
    payload = operation()
    assert bearer.post(endpoint, json=payload).status_code == 200
    other, user = account(client, "original-other")
    owned_by_other = mutate(other, "vehicle", {"name": "Other"}).json()["record"]["id"]
    assert issue(client, [owned_by_other]).status_code == 403
    with client.app.state.store.transaction() as c:
        c.exec_driver_sql("UPDATE vehicles SET owner_id=? WHERE id=?", (user, car))
    assert bearer.post(endpoint, json=payload).status_code == 403
    assert "Excluded" not in bearer.get(MACHINE + "/vehicles").text


def test_machine_revoke_write_transaction_boundary(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    key = issue(client, [car], write_enabled=True).json()
    bearer = machine(client, key["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    payload = operation()
    with ThreadPoolExecutor(max_workers=2) as executor:
        write = executor.submit(bearer.post, endpoint, json=payload)
        revoke = executor.submit(client.delete, MANAGEMENT + "/" + key["id"])
        result, revoked = write.result(), revoke.result()
    assert result.status_code in {200, 401}, result.text
    assert revoked.status_code == 200
    assert bearer.post(endpoint, json=payload).status_code == 401
    assert len(client.get("/api/v1/state").json()["events"]) == int(result.status_code == 200)


def test_machine_cannot_reuse_prior_human_odometer_confirmation(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented", "purchase_odometer": 1000}).json()[
        "record"
    ]["id"]
    corrected = mutate(
        client,
        "event",
        {
            "vehicle_id": car,
            "kind": "expense",
            "amount": "1",
            "odometer": 500,
            "occurred_at": "2026-10-01",
            "odometer_confirmed": True,
        },
    ).json()["record"]
    bearer = machine(client, issue(client, [car], write_enabled=True).json()["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    money_edit = operation(id=corrected["id"], base_version=1, data={"amount": "2"})
    assert bearer.post(endpoint, json=money_edit).status_code == 200
    odometer_edit = operation(id=corrected["id"], base_version=2, data={"odometer": 400})
    assert bearer.post(endpoint, json=odometer_edit).status_code == 422
    assert client.get("/api/v1/state").json()["events"][0]["odometer"] == 500


def test_machine_chunked_body_is_bounded_before_json_parsing(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    bearer = machine(client, issue(client, [car], write_enabled=True).json()["secret"])
    response = bearer.post(
        MACHINE + f"/vehicles/{car}/mutations",
        content=iter([b" " * (128 * 1024), b" " * (129 * 1024)]),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert client.get("/api/v1/state").json()["events"] == []


def test_machine_reminder_completion_requires_fresh_actual_reading_and_retries_once(client):
    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented", "purchase_odometer": 10000}).json()[
        "record"
    ]["id"]
    reminder = mutate(
        client,
        "reminder",
        {
            "vehicle_id": car,
            "title": "Oil",
            "due_date": "2026-10-01",
            "due_odometer": 15000,
            "repeat_days": 30,
            "repeat_km": 5000,
        },
    ).json()["record"]
    bearer = machine(client, issue(client, [car], write_enabled=True).json()["secret"])
    endpoint = MACHINE + f"/vehicles/{car}/mutations"
    missing = operation(
        entity="reminder",
        action="complete",
        id=reminder["id"],
        base_version=1,
        data={"completion_date": "2026-10-01"},
    )
    assert bearer.post(endpoint, json=missing).status_code == 422
    assert (
        bearer.post(endpoint, json={**missing, "data": {"completion_odometer": 15001}}).status_code
        == 422
    )
    from datetime import date, timedelta

    future = (date.today() + timedelta(days=1)).isoformat()
    assert (
        bearer.post(
            endpoint,
            json={**missing, "data": {"completion_date": future, "completion_odometer": 15001}},
        ).status_code
        == 422
    )
    payload = {**missing, "data": {**missing["data"], "completion_odometer": 15001}}
    completed = bearer.post(endpoint, json=payload)
    assert completed.status_code == 200, completed.text
    result = completed.json()["record"]
    assert result["due_odometer"] == 20001 and result["due_date"] == "2026-10-31"
    assert "completion_odometer" not in result
    assert bearer.post(endpoint, json=payload).json() == completed.json()
    assert (
        bearer.post(endpoint, json={**payload, "operation_id": str(uuid.uuid4())}).status_code
        == 409
    )
    assert (
        bearer.post(
            endpoint, json={**missing, "operation_id": str(uuid.uuid4()), "base_version": 2}
        ).status_code
        == 422
    )
    assert (
        bearer.post(
            endpoint,
            json={
                **payload,
                "operation_id": str(uuid.uuid4()),
                "base_version": 2,
                "data": {**payload["data"], "completed_at": "trusted"},
            },
        ).status_code
        == 422
    )
    state = client.get("/api/v1/state").json()
    assert state["events"] == [] and state["vehicles"][0]["current_odometer"] == 10000
    assert state["reminders"][0]["version"] == 2


@pytest.mark.parametrize(
    "corruption", ["verifier", "empty_grants", "private_response", "foreign_record"]
)
def test_machine_corrupt_archive_rejected_before_replacement(client, tmp_path, corruption):
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store

    client.app.state.machine_enabled = True
    car = mutate(client, "vehicle", {"name": "Invented"}).json()["record"]["id"]
    key = issue(client, [car], write_enabled=True).json()
    payload = operation()
    assert (
        machine(client, key["secret"])
        .post(MACHINE + f"/vehicles/{car}/mutations", json=payload)
        .status_code
        == 200
    )
    store = client.app.state.store
    with store.transaction() as c:
        if corruption == "verifier":
            c.exec_driver_sql("UPDATE machine_credentials SET token_hash=?", ("g" * 64,))
        elif corruption == "empty_grants":
            c.exec_driver_sql("DELETE FROM machine_vehicle_grants")
        elif corruption == "foreign_record":
            c.exec_driver_sql("UPDATE machine_receipts SET record_id=?", (str(uuid.uuid4()),))
        else:
            raw = json.loads(
                c.exec_driver_sql("SELECT response FROM machine_receipts").scalar_one()
            )
            raw["record"]["vin"] = "PRIVATE"
            c.exec_driver_sql("UPDATE machine_receipts SET response=?", (json.dumps(raw),))
    target = Store(tmp_path / "untouched")
    with pytest.raises(ValueError):
        restore_backup(target, make_backup(store))
    assert target.query("SELECT * FROM vehicles") == []
    target.close()
