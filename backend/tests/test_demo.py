from fastapi.testclient import TestClient
from backend.tests.test_api import mutate


def test_demo_isolated_from_real_and_each_other(client):
    real = mutate(client, "vehicle", {"name": "Private vehicle"}).json()["record"]
    first = TestClient(client.app)
    second = TestClient(client.app)
    demo = first.post("/api/v1/demo").json()
    first.headers["X-CSRF-Token"] = demo["csrf"]
    other = second.post("/api/v1/demo").json()
    second.headers["X-CSRF-Token"] = other["csrf"]
    state = first.get("/api/v1/state").json()
    assert len(state["vehicles"]) == 2
    assert len(state["events"]) > 30
    assert all(v["id"] != real["id"] for v in state["vehicles"])
    assert first.get("/api/v1/backup").status_code == 403
    assert first.get("/api/v1/export.json").status_code == 403
    assert mutate(first, "vehicle", {"name": "Changed demo"}).status_code == 200
    assert len(second.get("/api/v1/state").json()["vehicles"]) == 2
    assert len(client.get("/api/v1/state").json()["vehicles"]) == 1
    assert first.get("/api/v1/analytics").json()["consumption"] > 0
    first.post("/api/v1/logout")
    second.post("/api/v1/logout")
