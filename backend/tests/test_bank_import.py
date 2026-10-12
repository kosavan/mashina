"""Private bank review invariants; all fixtures are invented."""

from backend.storage import Store
from backend.tests.test_api import mutate
from backend.tests.test_access import account, grant
import json
import uuid
import pytest
from backend.backup import make_backup, restore_backup
from backend.bank_import import commit as commit_direct
from concurrent.futures import ThreadPoolExecutor

PREFIX = "/api/v1/bank"
MAPPING = {
    "date": "date",
    "amount": "amount",
    "description": "description",
    "transaction_id": "id",
    "date_format": "iso",
    "outgoing_sign": "negative",
    "default_currency": "RUB",
}


def source(client, car, label="Личная карта"):
    result = client.post(PREFIX + "/sources", json={"vehicle_id": car, "label": label})
    assert result.status_code == 200, result.text
    return result.json()["id"]


def preview(client, car, source_id, content=None, mapping=None):
    return client.post(
        PREFIX + "/preview",
        data={
            "vehicle_id": car,
            "source_id": source_id,
            "mapping": json.dumps(mapping or MAPPING),
            "encoding": "utf-8",
            "delimiter": "comma",
        },
        files={
            "file": (
                "invented.csv",
                content
                or b"date,amount,description,id,private\n2026-10-01,-100.01,Wash,A,UNMAPPED_MARKER\n",
                "text/csv",
            )
        },
    )


def commit(client, batch, decisions, operation=None):
    return client.post(
        PREFIX + "/commit",
        json={
            "operation_id": operation or str(uuid.uuid4()),
            "batch_id": batch,
            "decisions": decisions,
        },
    )


def test_bank_migration_is_additive_and_enforces_foreign_keys(tmp_path):
    store = Store(tmp_path / "bank")
    assert store.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "006"
    tables = {r["name"] for r in store.query("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"bank_sources", "bank_preview_batches", "bank_ledger", "bank_commit_receipts"} <= tables
    assert store.query("PRAGMA foreign_key_check") == []
    store.close()


def test_inspect_preview_private_and_create_retry(client):
    car = mutate(client, "vehicle", {"name": "Private"}).json()["record"]["id"]
    sid = source(client, car)
    assert source(client, car, "  личная КАРТА  ") == sid
    response = preview(client, car, sid)
    assert response.status_code == 200, response.text
    batch = response.json()
    assert "UNMAPPED_MARKER" not in response.text
    assert client.get("/api/v1/state").json()["events"] == []
    decisions = [
        {"row_id": 1, "action": "create", "category": "Мойка", "description": "Reviewed wash"}
    ]
    op = str(uuid.uuid4())
    first = commit(client, batch["batch_id"], decisions, op)
    assert first.status_code == 200, first.text
    assert first.json()["created"] == 1
    assert commit(client, batch["batch_id"], decisions, op).json() == first.json()
    assert (
        commit(client, batch["batch_id"], [{"row_id": 1, "action": "ignore"}], op).status_code
        == 409
    )
    again = preview(client, car, sid).json()
    assert again["rows"][0]["processed"] and not again["rows"][0]["conflict"]
    assert commit(client, again["batch_id"], decisions).json()["processed"] == 1
    state = client.get("/api/v1/state").json()
    assert len(state["events"]) == 1 and state["events"][0]["amount_minor"] == 10001
    assert state["events"][0]["odometer"] is None
    assert "Личная карта" not in json.dumps(state, ensure_ascii=False)
    assert "transaction_id" not in json.dumps(state)
    private = client.get(PREFIX + "/export", params={"vehicle_id": car})
    assert private.status_code == 200 and private.json()["ledger"][0]["decision"] == "create"


def test_link_fuel_and_service_does_not_change_original_records(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    for kind, extra in [
        ("fuel", {"liters": "10", "price": "10.001", "odometer": 100}),
        ("maintenance", {"items": [{"name": "Filter", "unit_price": "100.01"}]}),
    ]:
        event = mutate(
            client,
            "event",
            {
                "vehicle_id": car,
                "kind": kind,
                "amount": "100.01",
                "occurred_at": "2026-10-01",
                **extra,
            },
        ).json()["record"]
        raw_before = client.app.state.store.query(
            "SELECT data,version FROM events WHERE id=?", (event["id"],)
        )
        batch = preview(
            client,
            car,
            sid,
            f"date,amount,description,id\n2026-10-01,-100.01,{kind},{kind}\n".encode(),
        ).json()
        assert any(c["id"] == event["id"] for c in batch["rows"][0]["candidates"])
        result = commit(
            client,
            batch["batch_id"],
            [{"row_id": 1, "action": "link", "event_id": event["id"], "expected_version": 1}],
        )
        assert result.status_code == 200 and result.json()["linked"] == 1, result.text
        assert (
            client.app.state.store.query(
                "SELECT data,version FROM events WHERE id=?", (event["id"],)
            )
            == raw_before
        )
    assert len(client.get("/api/v1/state").json()["events"]) == 2


def test_stale_candidate_aborts_every_selected_row(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    event = mutate(
        client,
        "event",
        {"vehicle_id": car, "kind": "expense", "amount": "100.01", "occurred_at": "2026-10-01"},
    ).json()["record"]
    batch = preview(
        client,
        car,
        sid,
        b"date,amount,description,id\n2026-10-01,-2,New,B\n2026-10-01,-100.01,Match,A\n",
    ).json()
    mutate(
        client,
        "event",
        {"description": "Changed"},
        id=event["id"],
        action="update",
        expected_version=1,
    )
    result = commit(
        client,
        batch["batch_id"],
        [
            {"row_id": 1, "action": "create"},
            {"row_id": 2, "action": "link", "event_id": event["id"], "expected_version": 1},
        ],
    )
    assert result.status_code == 409, result.text
    assert len(client.get("/api/v1/state").json()["events"]) == 1
    assert client.app.state.store.query("SELECT * FROM bank_ledger") == []


def test_stable_id_cross_car_conflict_and_deleted_target(client):
    first = mutate(client, "vehicle", {"name": "One"}).json()["record"]["id"]
    second = mutate(client, "vehicle", {"name": "Two"}).json()["record"]["id"]
    sid = source(client, first)
    batch = preview(client, first, sid).json()
    result = commit(client, batch["batch_id"], [{"row_id": 1, "action": "create"}]).json()
    event_id = result["event_ids"][0]
    mutate(client, "event", {}, id=event_id, action="delete", expected_version=1)
    repeated = preview(client, second, sid).json()
    assert repeated["rows"][0]["processed"]
    assert (
        commit(client, repeated["batch_id"], [{"row_id": 1, "action": "create"}]).json()[
            "processed"
        ]
        == 1
    )
    changed = preview(
        client, first, sid, b"date,amount,description,id\n2026-10-01,-99,Changed,A\n"
    ).json()
    assert changed["rows"][0]["conflict"]
    assert (
        commit(client, changed["batch_id"], [{"row_id": 1, "action": "create"}]).status_code == 409
    )
    assert len(client.app.state.store.query("SELECT * FROM events")) == 1


def test_no_id_identical_purchases_and_changed_file_overlap(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    mapping = {**MAPPING, "transaction_id": None}
    content = b"date,amount,description\n2026-10-01,-10,Wash\n2026-10-01,-10,Wash\n"
    batch = preview(client, car, sid, content, mapping).json()
    result = commit(client, batch["batch_id"], [{"row_id": i, "action": "create"} for i in [1, 2]])
    assert result.status_code == 200 and result.json()["created"] == 2, result.text
    repeated = preview(client, car, sid, content, mapping).json()
    assert (
        commit(
            client, repeated["batch_id"], [{"row_id": i, "action": "create"} for i in [1, 2]]
        ).json()["processed"]
        == 2
    )
    other = preview(
        client,
        car,
        sid,
        content.replace(b"date,amount,description", b"date,amount,description,unmapped").replace(
            b"-10,Wash", b"-10,Wash,extra"
        ),
        mapping,
    ).json()
    assert other["rows"][0]["overlap"]
    assert commit(client, other["batch_id"], [{"row_id": 1, "action": "create"}]).status_code == 409
    assert (
        commit(
            client, other["batch_id"], [{"row_id": 1, "action": "create", "ack_separate": True}]
        ).json()["created"]
        == 1
    )


def test_actor_private_sources_batches_and_revalidation(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    batch = preview(client, car, sid).json()
    other, actor = account(client, "other")
    assert grant(client, car, actor).status_code == 200
    assert other.get(PREFIX + "/sources", params={"vehicle_id": car}).status_code == 403
    assert grant(client, car, actor, "owner").status_code == 200
    assert other.get(PREFIX + "/sources", params={"vehicle_id": car}).json() == []
    assert preview(other, car, sid).status_code == 403
    assert commit(other, batch["batch_id"], [{"row_id": 1, "action": "create"}]).status_code == 403
    other_sid = source(other, car)
    other_batch = preview(other, car, other_sid).json()
    assert grant(client, car, actor, "driver").status_code == 200
    assert (
        commit(other, other_batch["batch_id"], [{"row_id": 1, "action": "create"}]).status_code
        == 403
    )
    assert client.get("/api/v1/state").json()["events"] == []


def test_expiry_bounds_and_incoming_ignore(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    batches = [preview(client, car, sid).json() for _ in range(4)]
    assert len(client.app.state.store.query("SELECT * FROM bank_preview_batches")) == 3
    assert (
        commit(client, batches[0]["batch_id"], [{"row_id": 1, "action": "create"}]).status_code
        == 403
    )
    with client.app.state.store.transaction() as c:
        c.exec_driver_sql("UPDATE bank_preview_batches SET expires=0")
    assert (
        commit(client, batches[-1]["batch_id"], [{"row_id": 1, "action": "create"}]).status_code
        == 409
    )
    incoming = preview(
        client, car, sid, b"date,amount,description,id\n2026-10-01,100,Credit,I\n"
    ).json()
    assert (
        commit(client, incoming["batch_id"], [{"row_id": 1, "action": "create"}]).status_code == 422
    )
    assert (
        commit(client, incoming["batch_id"], [{"row_id": 1, "action": "ignore"}]).json()["ignored"]
        == 1
    )
    assert client.get("/api/v1/state").json()["events"] == []


def test_concurrent_lost_response_receipts_and_restore(client, tmp_path):
    car = mutate(client, "vehicle", {"name": "Restorable"}).json()["record"]["id"]
    sid = source(client, car)
    batch = preview(client, car, sid).json()
    from backend.bank_api import CommitInput

    payload = CommitInput(
        operation_id=uuid.uuid4(),
        batch_id=batch["batch_id"],
        decisions=[{"row_id": 1, "action": "create"}],
    ).model_dump(mode="json")
    store = client.app.state.store
    actor = store.query("SELECT id FROM users WHERE username='owner'")[0]["id"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: commit_direct(store, actor, payload), range(2)))
    assert results[0] == results[1] and results[0]["created"] == 1
    assert len(store.query("SELECT * FROM events")) == 1
    archive = make_backup(store)
    restored = Store(tmp_path / "restored-bank")
    restore_backup(restored, archive)
    assert restored.query("SELECT * FROM bank_preview_batches") == []
    assert commit_direct(restored, actor, payload) == results[0]
    assert len(restored.query("SELECT * FROM bank_ledger")) == 1
    assert restored.query("SELECT paused FROM notification_identity")[0]["paused"] == 1
    assert restored.query("SELECT * FROM sessions") == []
    restored.close()


def test_no_duplicate_link_and_forged_content_rejected(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    event = mutate(
        client,
        "event",
        {"vehicle_id": car, "kind": "expense", "amount": "100.01", "occurred_at": "2026-10-01"},
    ).json()["record"]
    batch = preview(client, car, sid).json()
    choice = {"row_id": 1, "action": "link", "event_id": event["id"], "expected_version": 1}
    assert commit(client, batch["batch_id"], [{**choice, "amount_minor": 1}]).status_code == 422
    assert commit(client, batch["batch_id"], [choice]).status_code == 200
    other = preview(
        client, car, sid, b"date,amount,description,id\n2026-10-01,-100.01,Other,B\n"
    ).json()
    assert other["rows"][0]["candidate_count"] == 0
    assert commit(client, other["batch_id"], [choice]).status_code == 409
    assert len(client.app.state.store.query("SELECT * FROM bank_ledger")) == 1


def test_bank_api_csrf_inspection_and_no_raw_persistence(client):
    car = mutate(client, "vehicle", {"name": "Car"}).json()["record"]["id"]
    sid = source(client, car)
    inspected = client.post(
        PREFIX + "/inspect",
        data={"vehicle_id": car, "encoding": "utf-8", "delimiter": "comma"},
        files={
            "file": (
                "private.csv",
                b"date,amount,description,id,private\n2026-10-01,-1,Wash,B,UNMAPPED_MARKER\n",
                "text/csv",
            )
        },
    )
    assert inspected.status_code == 200 and "UNMAPPED_MARKER" not in inspected.text
    assert set(inspected.json()) == {"headers", "row_count"}
    assert preview(client, car, sid).status_code == 200
    assert "UNMAPPED_MARKER" not in str(
        client.app.state.store.query("SELECT * FROM bank_preview_batches")
    )
    assert list(client.app.state.store.uploads.iterdir()) == []
    csrf = client.headers.pop("X-CSRF-Token")
    assert (
        client.post(PREFIX + "/sources", json={"vehicle_id": car, "label": "Blocked"}).status_code
        == 403
    )
    client.headers["X-CSRF-Token"] = csrf


@pytest.mark.parametrize("corruption", ["fingerprint", "foreign_source", "notification_identity"])
def test_corrupt_private_archive_rejected_before_replacement(client, tmp_path, corruption):
    car = mutate(client, "vehicle", {"name": "Source"}).json()["record"]["id"]
    sid = source(client, car)
    batch = preview(client, car, sid).json()
    assert commit(client, batch["batch_id"], [{"row_id": 1, "action": "create"}]).status_code == 200
    store = client.app.state.store
    with store.transaction() as c:
        if corruption == "fingerprint":
            c.exec_driver_sql("UPDATE bank_ledger SET fingerprint=?", ("0" * 64,))
        elif corruption == "foreign_source":
            other = str(uuid.uuid4())
            c.exec_driver_sql(
                "INSERT INTO users(id,username,password_hash) VALUES(?,?,?)",
                (other, "other-invalid", "!no-login"),
            )
            c.exec_driver_sql("UPDATE bank_sources SET actor_id=?", (other,))
        else:
            c.exec_driver_sql(
                "UPDATE notification_identity SET private_key='invalid',public_key='invalid'"
            )
    target = Store(tmp_path / "untouched")
    with pytest.raises(ValueError):
        restore_backup(target, make_backup(store))
    assert target.query("SELECT * FROM vehicles") == []
    target.close()


def test_committed_receipt_cannot_bypass_revocation_or_disabled_account(client):
    car = mutate(client, "vehicle", {"name": "Shared"}).json()["record"]["id"]
    other, actor = account(client, "bank-other")
    assert grant(client, car, actor, "owner").status_code == 200
    sid = source(other, car)
    batch = preview(other, car, sid).json()
    operation = str(uuid.uuid4())
    decisions = [{"row_id": 1, "action": "create"}]
    assert commit(other, batch["batch_id"], decisions, operation).status_code == 200
    assert client.delete(f"/api/v1/vehicles/{car}/access/{actor}").status_code == 200
    assert commit(other, batch["batch_id"], decisions, operation).status_code == 403
    assert grant(client, car, actor, "owner").status_code == 200
    assert client.patch("/api/v1/users/" + actor, json={"disabled": True}).status_code == 200
    assert commit(other, batch["batch_id"], decisions, operation).status_code == 401
    assert len(client.app.state.store.query("SELECT * FROM bank_ledger")) == 1


def test_admin_without_car_grant_and_demo_isolation(client):
    from fastapi.testclient import TestClient

    other, _ = account(client, "private-car-owner")
    foreign = mutate(other, "vehicle", {"name": "Not admin's car"}).json()["record"]["id"]
    assert client.get(PREFIX + "/sources", params={"vehicle_id": foreign}).status_code == 403
    demo = TestClient(client.app)
    session = demo.post("/api/v1/demo").json()
    demo.headers["X-CSRF-Token"] = session["csrf"]
    car = demo.get("/api/v1/state").json()["vehicles"][0]["id"]
    sid = source(demo, car)
    batch = preview(demo, car, sid).json()
    assert (
        commit(demo, batch["batch_id"], [{"row_id": 1, "action": "create"}]).json()["created"] == 1
    )
    assert client.app.state.store.query("SELECT * FROM bank_sources") == []
    assert client.app.state.store.query("SELECT * FROM bank_ledger") == []
    assert demo.post("/api/v1/logout").status_code == 200
