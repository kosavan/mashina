"""Notification privacy/security tests use fake transports only."""

import base64
import json
import pytest
from backend.tests.test_access import account


def subscription(endpoint="https://fcm.googleapis.com/fcm/send/test-only-endpoint"):
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization

    point = (
        ec.generate_private_key(ec.SECP256R1())
        .public_key()
        .public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    )

    def encode(value):
        return base64.urlsafe_b64encode(value).decode().rstrip("=")

    return {
        "endpoint": endpoint,
        "keys": {"auth": encode(b"test-only-auth!!"), "p256dh": encode(point)},
        "label": "Мой телефон",
    }


def test_default_off_demo_and_subscription_isolation(client):
    from backend.notifications import initialize_identity

    endpoint = "/api/v1/notifications"
    status = client.get(endpoint)
    assert status.status_code == 200
    assert not status.json()["push_configured"]
    assert not status.json()["telegram_configured"]
    initialize_identity(client.app.state.store)
    original = subscription()
    added = client.post(endpoint + "/push", json=original)
    assert added.status_code == 200, added.text
    private_id = added.json()["id"]
    status = client.get(endpoint).json()
    assert status["push"][0]["id"] == private_id
    assert original["endpoint"] not in json.dumps(status)
    assert original["keys"]["auth"] not in json.dumps(status)
    assert "notification_identity" not in client.get("/api/v1/export.json").text
    other, _ = account(client, "notification-other")
    assert other.get(endpoint).json()["push"] == []
    assert other.delete(endpoint + "/push/" + private_id).status_code == 403
    assert client.delete(endpoint + "/push/" + private_id).status_code == 200


@pytest.mark.parametrize(
    "url",
    [
        "http://fcm.googleapis.com/send/x",
        "https://127.0.0.1/x",
        "https://[::1]/x",
        "https://fcm.googleapis.com.evil.example/x",
        "https://evilpush.apple.com/x",
        "https://fcm.googleapis.com:444/x",
        "https://user@fcm.googleapis.com/x",
        "https://fcm.googleapis.com/x#fragment",
        "https://localhost/x",
    ],
)
def test_subscription_rejects_untrusted_origins(url):
    from backend.notification_transport import validate_subscription

    with pytest.raises(ValueError):
        validate_subscription(subscription(url))


def test_subscription_keys_and_dns_are_validated(monkeypatch):
    from backend.notification_transport import validate_subscription, global_addresses
    from backend import notification_transport

    value = subscription()
    value["keys"]["auth"] = "invalid"
    with pytest.raises(ValueError):
        validate_subscription(value)
    monkeypatch.setattr(
        notification_transport.socket,
        "getaddrinfo",
        lambda *a, **k: [(2, 1, 6, "", ("8.8.8.8", 443)), (2, 1, 6, "", ("127.0.0.1", 443))],
    )
    with pytest.raises(ValueError):
        global_addresses("fcm.googleapis.com")


def test_identity_survives_backup_but_restored_channels_pause(client, tmp_path):
    from backend.notifications import initialize_identity
    from backend.backup import make_backup, restore_backup
    from backend.storage import Store

    original = initialize_identity(client.app.state.store)
    assert initialize_identity(client.app.state.store) == original
    restored = Store(tmp_path / "notifications-restored")
    restore_backup(restored, make_backup(client.app.state.store))
    identity = restored.query("SELECT * FROM notification_identity")[0]
    assert identity["public_key"] == original
    assert identity["paused"] == 1
    assert identity["private_key"]
    restored.close()


def ready_reminder(client):
    from datetime import date, timedelta
    from backend.notifications import initialize_identity
    from backend.tests.test_api import mutate

    initialize_identity(client.app.state.store)
    device = client.post("/api/v1/notifications/push", json=subscription()).json()["id"]
    car = mutate(client, "vehicle", {"name": "PRIVATE CAR", "purchase_odometer": 1000}).json()[
        "record"
    ]
    reminder = mutate(
        client,
        "reminder",
        {
            "vehicle_id": car["id"],
            "title": "PRIVATE WORK",
            "due_date": (date.today() + timedelta(days=5)).isoformat(),
            "warning_days": 30,
        },
    ).json()["record"]
    return device, car, reminder


def test_dispatch_dry_run_cycle_stage_and_uncertainty(client):
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    from backend.tests.test_api import mutate

    calls = []
    device, car, reminder = ready_reminder(client)
    store = client.app.state.store

    def transport(channel, destination, identity):
        calls.append(channel)
        return ProviderResult("accepted")

    assert dispatch(store, transport=transport)["due"] == 1
    assert calls == [] and store.query("SELECT * FROM notification_deliveries") == []
    assert dispatch(store, send=True, transport=transport)["accepted"] == 1
    assert dispatch(store, send=True, transport=transport)["accepted"] == 0
    mutate(
        client,
        "reminder",
        {"title": "Renamed"},
        action="update",
        id=reminder["id"],
        expected_version=1,
    )
    assert dispatch(store, send=True, transport=transport)["accepted"] == 0
    assert len(calls) == 1
    mutate(
        client,
        "reminder",
        {"due_odometer": 999},
        action="update",
        id=reminder["id"],
        expected_version=2,
    )

    def uncertain(*args):
        return ProviderResult("uncertain", "transport_error")

    assert dispatch(store, send=True, transport=uncertain)["uncertain"] == 1
    assert dispatch(store, send=True, transport=transport)["accepted"] == 0
    receipt = store.query("SELECT id FROM notification_deliveries WHERE state='uncertain'")[0]["id"]
    endpoint = f"/api/v1/notifications/deliveries/{receipt}/retry"
    assert client.post(endpoint, json={"acknowledge_duplicates": False}).status_code == 422
    assert client.post(endpoint, json={"acknowledge_duplicates": True}).status_code == 200
    assert dispatch(store, send=True, transport=transport)["accepted"] == 1


def test_dispatch_expired_and_delayed_channels(client):
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    import time

    ready_reminder(client)
    store = client.app.state.store
    now = int(time.time())
    assert (
        dispatch(
            store,
            send=True,
            now=now,
            transport=lambda *args: ProviderResult("delayed", "rate_limited", 120),
        )["delayed"]
        == 1
    )
    assert (
        dispatch(store, send=True, now=now + 60, transport=lambda *args: pytest.fail("too early"))[
            "accepted"
        ]
        == 0
    )
    assert (
        dispatch(
            store,
            send=True,
            now=now + 121,
            transport=lambda *args: ProviderResult("rejected", "expired"),
        )["rejected"]
        == 1
    )
    assert not store.query("SELECT active FROM push_subscriptions")[0]["active"]


def test_telegram_link_codes_are_private_expiring_and_single_use(client, monkeypatch):
    from backend.notification_delivery import receive_telegram_links

    monkeypatch.setenv("MASHINA_TELEGRAM_BOT_TOKEN", "123456:" + "fake-test-only-value-" * 2)
    monkeypatch.setenv("MASHINA_TELEGRAM_BOT_USERNAME", "mashina_test_bot")
    code = client.post("/api/v1/notifications/telegram/code").json()["code"]
    assert (
        code
        not in client.app.state.store.query("SELECT code_hash FROM telegram_link_codes")[0][
            "code_hash"
        ]
    )

    def fetch(token, offset):
        return [
            {"update_id": 1, "message": {"text": code, "chat": {"id": -123, "type": "group"}}},
            {"update_id": 2, "message": {"text": code, "chat": {"id": 123, "type": "private"}}},
        ]

    assert receive_telegram_links(client.app.state.store, fetch=fetch) == 1
    assert client.get("/api/v1/notifications").json()["telegram_linked"]
    assert client.app.state.store.query("SELECT * FROM telegram_link_codes") == []
    assert receive_telegram_links(client.app.state.store, fetch=fetch) == 0
    assert client.delete("/api/v1/notifications/telegram").status_code == 200
    assert not client.get("/api/v1/notifications").json()["telegram_linked"]


def test_simultaneous_claims_and_current_access_recheck(client, tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    from backend.storage import Store
    import threading

    ready_reminder(client)
    first = client.app.state.store
    second = Store(first.path)
    calls, lock = [], threading.Lock()

    def transport(*args):
        with lock:
            calls.append(True)
        return ProviderResult("accepted")

    with ThreadPoolExecutor(2) as executor:
        results = list(
            executor.map(
                lambda store: dispatch(store, send=True, transport=transport), [first, second]
            )
        )
    assert len(calls) == 1
    assert sum(result["accepted"] for result in results) == 1
    second.close()


def test_logout_drops_only_current_users_device(client):
    from backend.notifications import initialize_identity

    initialize_identity(client.app.state.store)
    info = subscription()
    client.post("/api/v1/notifications/push", json=info)
    assert client.post(
        "/api/v1/notifications/push/current", json={"endpoint": info["endpoint"]}
    ).json()["id"]
    other, _ = account(client, "logout-other")
    assert other.post("/api/v1/logout", json={"push_endpoint": info["endpoint"]}).status_code == 200
    assert len(client.get("/api/v1/notifications").json()["push"]) == 1
    assert (
        client.post("/api/v1/logout", json={"push_endpoint": info["endpoint"]}).status_code == 200
    )
    assert client.app.state.store.query("SELECT * FROM push_subscriptions") == []


def test_transport_pins_global_address_without_redirect_or_proxy(monkeypatch):
    from backend import notification_transport as transport
    import urllib3

    calls = []

    class Response:
        status = 302
        headers = {"Location": "http://127.0.0.1/private"}

        def read(self, count):
            return b"not followed"

        def close(self):
            pass

    class Pool:
        def __init__(self, host, **kwargs):
            calls.append((host, kwargs))

        def urlopen(self, method, path, **kwargs):
            calls.append((path, kwargs))
            return Response()

        def close(self):
            pass

    monkeypatch.setattr(transport, "global_addresses", lambda host: ["8.8.8.8"])
    monkeypatch.setattr(urllib3, "HTTPSConnectionPool", Pool)
    status, _, _ = transport.safe_request("https://fcm.googleapis.com/test")
    assert status == 302
    assert calls[0][0] == "8.8.8.8"
    assert calls[0][1]["assert_hostname"] == "fcm.googleapis.com"
    assert calls[0][1]["server_hostname"] == "fcm.googleapis.com"
    assert calls[1][1]["redirect"] is False and calls[1][1]["retries"] is False
    assert calls[1][1]["headers"]["Host"] == "fcm.googleapis.com"


def test_due_reminders_budget_and_driver_exclusion(client):
    from backend.notification_delivery import due_targets
    from backend.storage import dumps
    from backend.tests.test_access import grant
    import uuid
    import time

    _, car, reminder = ready_reminder(client)
    driver, user = account(client, "notify-driver")
    grant(client, car["id"], user)
    driver.post(
        "/api/v1/notifications/push",
        json=subscription("https://fcm.googleapis.com/fcm/send/second"),
    )
    actor = client.get("/api/v1/session").json()["id"]
    with client.app.state.store.transaction() as c:
        for _ in range(999):
            c.exec_driver_sql(
                "INSERT INTO reminders(id,owner_id,vehicle_id,version,data,deleted) VALUES(?,?,?,1,?,0)",
                (str(uuid.uuid4()), actor, car["id"], dumps(reminder)),
            )
    started = time.perf_counter()
    targets = due_targets(client.app.state.store, int(time.time()))
    assert time.perf_counter() - started < 1
    assert len(targets) == 1000
    assert all(item["user_id"] != user for item in targets)


def test_same_device_receives_one_generic_notice_for_multiple_reminders(client):
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    from backend.tests.test_api import mutate

    _, car, reminder = ready_reminder(client)
    mutate(
        client,
        "reminder",
        {"vehicle_id": car["id"], "title": "Second", "due_date": reminder["due_date"]},
    )
    calls = []

    def transport(*args):
        calls.append(True)
        return ProviderResult("accepted")

    result = dispatch(client.app.state.store, send=True, transport=transport)
    assert result["accepted"] == 2
    assert len(calls) == 1


def test_fixed_calendar_stage_changes_once_without_daily_spam(client):
    from datetime import datetime
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    from backend.tests.test_api import mutate

    _, _, reminder = ready_reminder(client)
    mutate(
        client,
        "reminder",
        {"due_date": "2026-10-05"},
        action="update",
        id=reminder["id"],
        expected_version=1,
    )
    calls = []

    def send(*args):
        calls.append(True)
        return ProviderResult("accepted")

    def epoch(day):
        return int(datetime(2026, 10, day, 12).timestamp())

    for day, count in ((1, 1), (2, 0), (5, 1), (6, 0)):
        assert (
            dispatch(client.app.state.store, send=True, now=epoch(day), transport=send)["accepted"]
            == count
        )
    assert len(calls) == 2
    mutate(
        client,
        "reminder",
        {"completion_odometer": 1000, "completion_date": "2026-10-06"},
        action="complete",
        id=reminder["id"],
        expected_version=2,
    )
    assert dispatch(client.app.state.store, send=True, now=epoch(7), transport=send)["due"] == 0


def test_restore_refuses_while_dispatcher_holds_interprocess_guard(client):
    from backend.notifications import notification_guard
    from backend.backup import make_backup, restore_backup

    store = client.app.state.store
    archive = make_backup(store)
    with notification_guard(store.path):
        with pytest.raises(ValueError, match="таймер"):
            restore_backup(store, archive)
    assert store.query("SELECT username FROM users")[0]["username"] == "owner"


def test_revocation_after_claim_cancels_without_calling_provider(client, monkeypatch):
    from backend import notification_delivery
    from backend.tests.test_access import grant

    _, car, _ = ready_reminder(client)
    delegate, user = account(client, "notify-owner")
    grant(client, car["id"], user, "owner")
    delegate.post(
        "/api/v1/notifications/push",
        json=subscription("https://fcm.googleapis.com/fcm/send/delegate"),
    )
    actor = client.get("/api/v1/session").json()["id"]
    with client.app.state.store.transaction() as c:
        c.exec_driver_sql("UPDATE notification_preferences SET enabled=0 WHERE user_id=?", (actor,))
    original = notification_delivery.due_targets

    def revoke(store, now, actor="", reminder_id=""):
        if actor:
            with store.transaction() as c:
                c.exec_driver_sql("DELETE FROM vehicle_access WHERE user_id=?", (user,))
        return original(store, now, actor, reminder_id)

    monkeypatch.setattr(notification_delivery, "due_targets", revoke)
    result = notification_delivery.dispatch(
        client.app.state.store,
        send=True,
        transport=lambda *args: pytest.fail("revoked provider call"),
    )
    assert result["cancelled"] == 1


def test_real_push_encryption_uses_pinned_transport_without_exposing_identity(client, monkeypatch):
    from backend.notifications import initialize_identity
    from backend import notification_transport

    initialize_identity(client.app.state.store)
    identity = client.app.state.store.query("SELECT private_key FROM notification_identity")[0][
        "private_key"
    ]
    sent = []

    def fake(url, **kwargs):
        sent.append(kwargs)
        return 201, {}, b""

    monkeypatch.setattr(notification_transport, "safe_request", fake)
    outcome = notification_transport.send_push(subscription(), identity)
    assert outcome.state == "accepted"
    assert len(sent) == 1
    assert b"MASHINA" not in sent[0]["data"]
    assert identity not in str(sent[0]["headers"])
    assert "vapid" in str(sent[0]["headers"]).lower()


def test_telegram_transport_redacts_token_and_preserves_rate_limit(monkeypatch, caplog):
    from backend import notification_transport

    token = "123456:" + "fake-test-only-value-" * 2

    def broken(*args, **kwargs):
        raise OSError("URL contained " + token)

    monkeypatch.setattr(notification_transport, "safe_request", broken)
    result = notification_transport.send_telegram(token, "123")
    assert result.state == "uncertain" and token not in str(result) and token not in caplog.text
    limited = notification_transport.classify(
        429, {}, b'{"parameters":{"retry_after":600}}', telegram=True
    )
    assert limited.state == "delayed" and limited.retry_after == 600


def test_expired_telegram_code_cannot_bind_private_chat(client, monkeypatch):
    from backend.notification_delivery import receive_telegram_links
    import time

    monkeypatch.setenv("MASHINA_TELEGRAM_BOT_TOKEN", "123456:" + "fake-test-only-value-" * 2)
    monkeypatch.setenv("MASHINA_TELEGRAM_BOT_USERNAME", "mashina_test_bot")
    code = client.post("/api/v1/notifications/telegram/code").json()["code"]
    now = int(time.time())
    with client.app.state.store.transaction() as c:
        c.exec_driver_sql("UPDATE telegram_link_codes SET expires=?", (now,))
    updates = [{"update_id": 1, "message": {"text": code, "chat": {"id": 123, "type": "private"}}}]
    assert receive_telegram_links(client.app.state.store, now=now, fetch=lambda *args: updates) == 0
    assert not client.get("/api/v1/notifications").json()["telegram_linked"]
    assert client.app.state.store.query("SELECT * FROM telegram_link_codes") == []


def test_interrupted_claim_never_retries_silently(client):
    from backend.notification_delivery import dispatch, due_targets
    import time

    ready_reminder(client)
    store = client.app.state.store
    now = int(time.time())
    target = due_targets(store, now)[0]
    with store.transaction() as c:
        c.exec_driver_sql(
            "INSERT INTO notification_deliveries(id,user_id,reminder_id,channel,destination_id,cycle,stage,state,updated,attempts,auto_attempts) VALUES(?,?,?,?,?,?,?,'sending',?,1,1)",
            tuple(
                target[key]
                for key in (
                    "id",
                    "user_id",
                    "reminder_id",
                    "channel",
                    "destination_id",
                    "cycle",
                    "stage",
                )
            )
            + (now - 121,),
        )
    dispatch(store, send=True, now=now, transport=lambda *args: pytest.fail("silent retry"))
    receipt = store.query("SELECT state,error_code,attempts FROM notification_deliveries")[0]
    assert receipt == {"state": "uncertain", "error_code": "interrupted", "attempts": 1}


def test_rate_limit_stops_after_five_attempts_and_explicit_retry_retains_total(client):
    from backend.notification_delivery import dispatch
    from backend.notification_transport import ProviderResult
    import time

    ready_reminder(client)
    store, now = client.app.state.store, int(time.time())
    calls = []

    def limited(*args):
        calls.append(True)
        return ProviderResult("delayed", "rate_limited", 60)

    for attempt in range(6):
        dispatch(store, send=True, now=now + attempt * 61, transport=limited)
    receipt = store.query("SELECT * FROM notification_deliveries")[0]
    assert len(calls) == 5 and receipt["state"] == "rejected"
    assert receipt["error_code"] == "retry_limit" and receipt["attempts"] == 5
    response = client.post(
        f"/api/v1/notifications/deliveries/{receipt['id']}/retry",
        json={"acknowledge_duplicates": True},
    )
    assert response.status_code == 200
    dispatch(store, send=True, now=now + 400, transport=lambda *args: ProviderResult("accepted"))
    receipt = store.query("SELECT * FROM notification_deliveries")[0]
    assert receipt["state"] == "accepted" and receipt["attempts"] == 6
