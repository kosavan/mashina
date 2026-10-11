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
    assert reopened.query("SELECT version_num FROM alembic_version")[0]["version_num"] == "001"
    reopened.close()
