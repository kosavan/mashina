from fastapi.testclient import TestClient
from backend.app import create_app
from backend.tests.test_api import mutate
import pytest


@pytest.mark.parametrize("locale", ["ru", "en", "de", "zh", "hi", "es", "ar", "fr"])
def test_setup_persists_validated_locale(tmp_path, locale):
    app = create_app(tmp_path, bootstrap_token="local-test-code")
    with TestClient(app) as client:
        fields = {
            "username": "owner",
            "password": "local-test-password",
            "bootstrap_token": "local-test-code",
        }
        assert client.post("/api/v1/setup", json={**fields, "locale": "ja"}).status_code == 422
        response = client.post("/api/v1/setup", json={**fields, "locale": locale})
        assert response.status_code == 200
        assert client.get("/api/v1/state").json()["settings"]["locale"] == locale


@pytest.mark.parametrize("locale", ["en", "de", "ru", "zh", "hi", "es", "ar", "fr"])
def test_locale_settings_do_not_change_user_records(client, locale):
    car = mutate(client, "vehicle", {"name": "Моя машина"}).json()["record"]
    assert mutate(client, "settings", {"locale": locale, "theme": "light"}).status_code == 200
    state = client.get("/api/v1/state").json()
    assert state["settings"] == {"locale": locale, "theme": "light"}
    assert state["vehicles"][0]["name"] == car["name"]
    assert mutate(client, "settings", {"locale": "ja"}).status_code == 422
    assert client.get("/api/v1/state").json()["settings"]["locale"] == locale


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


def test_german_preference_survives_restore_and_restart(client, tmp_path):
    from backend.backup import restore_backup
    from backend.storage import Store

    car = mutate(client, "vehicle", {"name": "История"}).json()["record"]
    event = mutate(
        client, "event", {
            "vehicle_id": car["id"], "kind": "expense", "occurred_at": "2026-01-15",
            "amount": "1234.56", "description": "История", "category": "Топливо",
        },
    ).json()["record"]
    assert mutate(client, "settings", {"locale": "de", "theme": "light"}).status_code == 200
    archive = client.get("/api/v1/backup").content
    location = tmp_path / "german-restored"
    restored = Store(location)
    restore_backup(restored, archive)
    restored.close()
    restarted = Store(location)
    try:
        owner = restarted.query("SELECT id FROM users")[0]["id"]
        state = restarted.state(owner)
        assert state["settings"] == {"locale": "de", "theme": "light"}
        assert state["vehicles"][0]["id"] == car["id"]
        assert state["vehicles"][0]["name"] == "История"
        assert state["events"][0]["id"] == event["id"]
        assert state["events"][0]["description"] == "История"
        assert state["events"][0]["category"] == "Топливо"
        assert state["events"][0]["amount_minor"] == 123456
    finally:
        restarted.close()
