from fastapi.testclient import TestClient
from backend.app import create_app
from backend.tests.test_api import mutate


def test_setup_persists_validated_locale(tmp_path):
    app = create_app(tmp_path, bootstrap_token="local-test-code")
    with TestClient(app) as client:
        fields = {
            "username": "owner",
            "password": "local-test-password",
            "bootstrap_token": "local-test-code",
        }
        assert client.post("/api/v1/setup", json={**fields, "locale": "de"}).status_code == 422
        response = client.post("/api/v1/setup", json={**fields, "locale": "en"})
        assert response.status_code == 200
        assert client.get("/api/v1/state").json()["settings"]["locale"] == "en"


def test_locale_settings_do_not_change_user_records(client):
    car = mutate(client, "vehicle", {"name": "Моя машина"}).json()["record"]
    assert mutate(client, "settings", {"locale": "en", "theme": "light"}).status_code == 200
    state = client.get("/api/v1/state").json()
    assert state["settings"] == {"locale": "en", "theme": "light"}
    assert state["vehicles"][0]["name"] == car["name"]
    assert mutate(client, "settings", {"locale": "de"}).status_code == 422
    assert client.get("/api/v1/state").json()["settings"]["locale"] == "en"


def test_partial_settings_preserve_existing_and_future_preferences(client):
    import json

    store = client.app.state.store
    with store.transaction() as c:
        c.exec_driver_sql(
            "UPDATE users SET settings=?",
            (
                json.dumps(
                    {
                        "theme": "light",
                        "locale": "ru",
                        "last_category": "fuel",
                        "future_preference": {"keep": True},
                    }
                ),
            ),
        )
    assert (
        mutate(client, "settings", {"locale": "en", "unknown_input": "ignored"}).status_code == 200
    )
    assert client.get("/api/v1/state").json()["settings"] == {
        "theme": "light",
        "locale": "en",
        "last_category": "fuel",
        "future_preference": {"keep": True},
    }
