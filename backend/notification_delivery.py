"""Bounded explicit dispatch; provider acceptance is never a delivery receipt."""

from datetime import date
import json
import time

from backend.domain import reminder_status
from backend.output_locale import user_locale
from backend.notifications import digest, telegram_config
from backend.notification_transport import (
    ProviderResult,
    send_push,
    send_telegram,
    telegram_request,
)


def due_targets(store, now, actor="", reminder_id=""):
    result = []
    with store.transaction() as c:
        identity = dict(
            c.exec_driver_sql("SELECT * FROM notification_identity WHERE id=1").mappings().first()
        )
        if identity["paused"]:
            return result
        rows = c.exec_driver_sql(
            """SELECT r.id,r.data,r.vehicle_id,v.data AS car_data,u.id AS actor,
            (SELECT MAX(json_extract(e.data,'$.odometer')) FROM events e WHERE e.vehicle_id=v.id AND e.deleted=0) AS maximum
            FROM reminders r JOIN vehicles v ON r.vehicle_id=v.id JOIN users u
            ON (v.owner_id=u.id OR EXISTS(SELECT 1 FROM vehicle_access a WHERE a.vehicle_id=v.id AND a.user_id=u.id AND a.role='owner'))
            JOIN notification_preferences p ON p.user_id=u.id AND p.enabled=1
            WHERE u.disabled=0 AND v.deleted=0 AND r.deleted=0 AND (?='' OR u.id=?) AND (?='' OR r.id=?)
            ORDER BY u.id,r.id""",
            (actor, actor, reminder_id, reminder_id),
        ).mappings()
        destinations = {}
        for row in rows:
            car, reminder = json.loads(row["car_data"]), json.loads(row["data"])
            if car.get("status", "active") != "active":
                continue
            odometer = max(car.get("purchase_odometer", 0), row["maximum"] or 0)
            stage = reminder_status(reminder, odometer, date.fromtimestamp(now).isoformat())[
                "status"
            ]
            if stage not in {"soon", "overdue"}:
                continue
            owner = row["actor"]
            if owner not in destinations:
                channels = []
                if identity["private_key"]:
                    channels += [
                        ("push", p["id"], p["data"])
                        for p in c.exec_driver_sql(
                            "SELECT id,data FROM push_subscriptions WHERE user_id=? AND active=1",
                            (owner,),
                        ).mappings()
                    ]
                if telegram_config()[0]:
                    link = c.exec_driver_sql(
                        "SELECT chat_id FROM telegram_links WHERE user_id=?", (owner,)
                    ).first()
                    if link:
                        channels.append(("telegram", digest(link[0]), link[0]))
                destinations[owner] = channels
            cycle = digest(
                json.dumps(
                    [
                        reminder.get("due_date"),
                        reminder.get("due_odometer"),
                        reminder.get("completed_at", ""),
                    ]
                )
            )
            for channel, destination_id, destination in destinations[owner]:
                key = digest(json.dumps([owner, row["id"], channel, destination_id, cycle, stage]))
                result.append(
                    {
                        "id": key,
                        "user_id": owner,
                        "reminder_id": row["id"],
                        "channel": channel,
                        "destination_id": destination_id,
                        "destination": destination,
                        "cycle": cycle,
                        "stage": stage,
                    }
                )
    return result


def provider_transport(channel, destination, identity):
    if channel == "push":
        return send_push(json.loads(destination), identity["private_key"], identity.get("locale", "ru"))
    return send_telegram(telegram_config()[0], destination, identity.get("locale", "ru"))


def dispatch(store, *, send=False, now=None, transport=provider_transport):
    now = int(now if now is not None else time.time())
    targets = due_targets(store, now)
    counts = {
        "due": len(targets),
        "accepted": 0,
        "rejected": 0,
        "uncertain": 0,
        "delayed": 0,
        "cancelled": 0,
    }
    if not send:
        return counts
    deadline = time.monotonic() + 60
    with store.transaction() as c:
        c.exec_driver_sql(
            "UPDATE notification_deliveries SET state='uncertain',error_code='interrupted' WHERE state='sending' AND updated<?",
            (now - 120,),
        )
        for target in targets:
            c.exec_driver_sql(
                "INSERT OR IGNORE INTO notification_deliveries(id,user_id,reminder_id,channel,destination_id,cycle,stage,state,updated) VALUES(?,?,?,?,?,?,?,'ready',?)",
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
                + (now,),
            )
        current_keys = {item["id"] for item in targets}
        for row in c.exec_driver_sql(
            "SELECT id FROM notification_deliveries WHERE state IN ('ready','delayed')"
        ).all():
            if row[0] not in current_keys:
                c.exec_driver_sql(
                    "UPDATE notification_deliveries SET state='cancelled',updated=? WHERE id=?",
                    (now, row[0]),
                )
    groups = {}
    claimed = 0
    for target in targets:
        if claimed >= 50 or time.monotonic() >= deadline:
            break
        with store.transaction() as c:
            claim = c.exec_driver_sql(
                "UPDATE notification_deliveries SET state='sending',attempts=attempts+1,auto_attempts=auto_attempts+1,updated=? WHERE id=? AND state IN ('ready','delayed') AND retry_at<=? AND auto_attempts<5",
                (now, target["id"], now),
            )
            if claim.rowcount != 1:
                continue
        claimed += 1
        groups.setdefault(
            (target["user_id"], target["channel"], target["destination_id"]), []
        ).append(target)
    for (actor, channel, destination_id), group in groups.items():
        if time.monotonic() >= deadline:
            with store.transaction() as c:
                for target in group:
                    c.exec_driver_sql(
                        "UPDATE notification_deliveries SET state='ready',attempts=attempts-1,auto_attempts=auto_attempts-1 WHERE id=? AND state='sending'",
                        (target["id"],),
                    )
            continue
        # Recheck owner/account/deadline/consent/binding after claims; one generic
        # message covers the valid group. No DB transaction is held during HTTP.
        current = {item["id"]: item for item in due_targets(store, now, actor)}
        fresh = [current[item["id"]] for item in group if item["id"] in current]
        if fresh:
            identity = store.query("SELECT * FROM notification_identity WHERE id=1")[0]
            identity = {**identity, "locale": user_locale(store, actor)}
            try:
                outcome = transport(channel, fresh[0]["destination"], identity)
            except Exception:
                outcome = ProviderResult("uncertain", "transport_error")
        else:
            outcome = ProviderResult("cancelled", "access_or_channel_changed")
        if outcome.state not in {"accepted", "rejected", "uncertain", "delayed", "cancelled"}:
            outcome = ProviderResult("uncertain", "invalid_transport_result")
        error = (
            outcome.code
            if outcome.code
            in {
                "expired",
                "rate_limited",
                "provider_rejected",
                "provider_error",
                "transport_error",
                "invalid_response",
                "access_or_channel_changed",
                "invalid_transport_result",
            }
            else ""
        )
        with store.transaction() as c:
            for target in group:
                state = outcome.state if target["id"] in current else "cancelled"
                code = error if state != "cancelled" else "access_or_channel_changed"
                automatic_attempts = c.exec_driver_sql(
                    "SELECT auto_attempts FROM notification_deliveries WHERE id=?", (target["id"],)
                ).scalar()
                if state == "delayed" and automatic_attempts >= 5:
                    state, code = "rejected", "retry_limit"
                c.exec_driver_sql(
                    "UPDATE notification_deliveries SET state=?,error_code=?,retry_at=?,updated=? WHERE id=? AND state='sending'",
                    (
                        state,
                        code,
                        now + min(86400, max(60, outcome.retry_after)) if state == "delayed" else 0,
                        now,
                        target["id"],
                    ),
                )
                counts[state] += 1
            if error == "expired" and channel == "push":
                c.exec_driver_sql(
                    "UPDATE push_subscriptions SET active=0 WHERE id=?", (destination_id,)
                )
    return counts


def fetch_telegram_updates(token, offset):
    status, _, content = telegram_request(
        token,
        "getUpdates",
        {"offset": offset, "limit": 50, "timeout": 0, "allowed_updates": ["message"]},
    )
    if status != 200:
        raise ValueError(
            "Не удалось получить сообщения бота; проверьте настройки и повторите позже."
        )
    try:
        response = json.loads(content)
        if not response.get("ok") or not isinstance(response.get("result"), list):
            raise ValueError()
        return response["result"][:50]
    except (ValueError, AttributeError):
        raise ValueError("Сервис бота вернул неподходящий ответ") from None


def receive_telegram_links(store, *, now=None, fetch=fetch_telegram_updates):
    now = int(now if now is not None else time.time())
    token, _ = telegram_config()
    identity = store.query("SELECT paused,telegram_offset FROM notification_identity WHERE id=1")[0]
    if not token or identity["paused"]:
        return 0
    try:
        updates = fetch(token, identity["telegram_offset"])
    except Exception:
        raise ValueError(
            "Не удалось получить привязки Telegram. Проверьте конфигурацию и соединение."
        ) from None
    linked, offset = 0, identity["telegram_offset"]
    with store.transaction() as c:
        c.exec_driver_sql("DELETE FROM telegram_link_codes WHERE expires<=?", (now,))
        for update in updates[:50]:
            if (
                not isinstance(update, dict)
                or not isinstance(update.get("update_id"), int)
                or update["update_id"] < offset
            ):
                continue
            offset = update["update_id"] + 1
            message = update.get("message", {})
            if not isinstance(message, dict):
                continue
            chat, text = message.get("chat", {}), message.get("text", "")
            if not isinstance(chat, dict):
                continue
            if (
                chat.get("type") != "private"
                or not isinstance(chat.get("id"), int)
                or chat["id"] <= 0
                or not isinstance(text, str)
                or len(text) > 100
            ):
                continue
            row = c.exec_driver_sql(
                "SELECT l.user_id FROM telegram_link_codes l JOIN users u ON l.user_id=u.id WHERE l.code_hash=? AND l.expires>? AND u.disabled=0",
                (digest(text.strip()), now),
            ).first()
            if not row:
                continue
            existing = c.exec_driver_sql(
                "SELECT user_id FROM telegram_links WHERE chat_id=?", (str(chat["id"]),)
            ).first()
            if existing and existing[0] != row[0]:
                continue
            c.exec_driver_sql(
                "INSERT INTO telegram_links(user_id,chat_id,created) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id,created=excluded.created",
                (row[0], str(chat["id"]), now),
            )
            c.exec_driver_sql("DELETE FROM telegram_link_codes WHERE user_id=?", (row[0],))
            c.exec_driver_sql(
                "INSERT INTO notification_preferences(user_id,enabled) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET enabled=1",
                (row[0],),
            )
            linked += 1
        c.exec_driver_sql(
            "UPDATE notification_identity SET telegram_offset=? WHERE id=1", (offset,)
        )
    return linked
