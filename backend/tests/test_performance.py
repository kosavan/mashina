import time
import uuid
from backend.domain import analytics
from backend.storage import Store


def test_10000_events_analytics_budget():
    car = {"id": "car", "name": "Car", "purchase_date": "2025-01-01", "purchase_odometer": 0}
    events = [
        {
            "vehicle_id": "car",
            "kind": "expense",
            "occurred_at": "2026-01-01",
            "amount_minor": 10000,
            "currency": "RUB",
            "odometer": i,
        }
        for i in range(10000)
    ]
    start = time.perf_counter()
    result = analytics([car], events)
    elapsed = time.perf_counter() - start
    assert result["total_minor"] == 100000000
    assert elapsed < 1.0, f"10K event calculation: {elapsed:.3f}s exceeds budget"


def test_migration_restart_preserves_history(tmp_path):
    store = Store(tmp_path)
    owner = str(uuid.uuid4())
    with store.transaction() as c:
        c.exec_driver_sql(
            "INSERT INTO users(id,username,password_hash) VALUES(?,?,?)",
            (owner, "migration-test", "!no-login"),
        )
    car = store.mutate(
        owner,
        {
            "entity": "vehicle",
            "action": "create",
            "operation_id": str(uuid.uuid4()),
            "id": str(uuid.uuid4()),
            "data": {"name": "Persistent"},
        },
    )["record"]
    store.close()
    reopened = Store(tmp_path)
    assert reopened.state(owner)["vehicles"][0]["id"] == car["id"]
    assert reopened.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "005"
    reopened.close()


def test_bank_1000_rows_against_10000_equal_amount_events(client):
    """Worst same-amount/day bucket: matching must not scan 10K events per row."""
    import json
    from backend.tests.test_api import mutate
    from backend.tests.test_bank_import import source, preview

    car = mutate(client, "vehicle", {"name": "Performance"}).json()["record"]["id"]
    sid = source(client, car)
    actor = client.app.state.store.query("SELECT id FROM users WHERE username='owner'")[0]["id"]
    data = json.dumps(
        {
            "kind": "expense",
            "amount_minor": 10001,
            "currency": "RUB",
            "occurred_at": "2026-10-01",
            "description": "Synthetic",
        }
    )
    with client.app.state.store.transaction() as c:
        c.exec_driver_sql(
            "INSERT INTO events(id,owner_id,version,data,vehicle_id,created_by) VALUES(?,?,1,?,?,?)",
            [(str(uuid.uuid4()), actor, data, car, actor) for _ in range(10000)],
        )
    content = (
        "date,amount,description,id\n"
        + "".join(f"2026-10-01,-100.01,Synthetic,{i}\n" for i in range(1000))
    ).encode()
    started = time.perf_counter()
    response = preview(client, car, sid, content)
    elapsed = time.perf_counter() - started
    assert response.status_code == 200, response.text
    assert len(response.json()["rows"]) == 1000
    assert all(
        r["candidate_count"] == 10000 and len(r["candidates"]) == 5 for r in response.json()["rows"]
    )
    assert elapsed < 2.0, f"Bank review 1000×10000: {elapsed:.3f}s exceeds budget"
