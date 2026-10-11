"""Optional private channel configuration. No work/network runs at app startup."""

import base64
from contextlib import contextmanager
import hashlib
import json
import os
import re
import secrets
import time
import uuid
from pathlib import Path

from fastapi import Depends, Request
from filelock import FileLock, Timeout
from pydantic import BaseModel, ConfigDict, Field

from backend.storage import Denied, dumps
from backend.notification_transport import validate_subscription


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def notification_guard(path):
    try:
        with FileLock(str(Path(path) / ".notification-dispatch.lock"), timeout=0):
            yield
    except Timeout:
        raise ValueError(
            "Работает отправка уведомлений. Приостановите таймер и повторите."
        ) from None


def initialize_identity(store):
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization

    with store.transaction() as c:
        row = c.exec_driver_sql("SELECT public_key FROM notification_identity WHERE id=1").first()
        if row[0]:
            return row[0]
        key = ec.generate_private_key(ec.SECP256R1())

        def encode(value):
            return base64.urlsafe_b64encode(value).decode().rstrip("=")

        private = encode(
            key.private_bytes(
                serialization.Encoding.DER,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        public = encode(
            key.public_key().public_bytes(
                serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
            )
        )
        c.exec_driver_sql(
            "UPDATE notification_identity SET private_key=?,public_key=? WHERE id=1",
            (private, public),
        )
        return public


def telegram_config():
    token = os.getenv("MASHINA_TELEGRAM_BOT_TOKEN", "")
    username = os.getenv("MASHINA_TELEGRAM_BOT_USERNAME", "")
    configured = bool(
        re.fullmatch(r"[0-9]{5,20}:[A-Za-z0-9_-]{20,100}", token)
        and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", username)
    )
    return token if configured else "", username if configured else ""


def real_session(s):
    if s["demo"]:
        raise Denied("Демогараж не подключается к внешним сервисам")


class PushKeys(BaseModel):
    model_config = ConfigDict(extra="forbid")
    auth: str = Field(max_length=64)
    p256dh: str = Field(max_length=128)


class PushInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    endpoint: str = Field(max_length=4096)
    keys: PushKeys
    label: str = Field(default="Это устройство", max_length=60)
    expirationTime: int | None = None


class PreferenceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


class EndpointInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    endpoint: str = Field(max_length=4096)


class RetryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    acknowledge_duplicates: bool


def install_notifications(app, session, throttle):
    prefix = "/api/v1/notifications"

    @app.get(prefix)
    def status(s=Depends(session)):
        real_session(s)
        store, actor = s["store"], s["user_id"]
        with store.transaction() as c:
            identity = c.exec_driver_sql(
                "SELECT public_key,paused FROM notification_identity WHERE id=1"
            ).first()
            pref = c.exec_driver_sql(
                "SELECT enabled FROM notification_preferences WHERE user_id=?", (actor,)
            ).first()
            token, bot = telegram_config()
            return {
                "push_configured": bool(identity[0]),
                "public_key": identity[0],
                "paused_after_restore": bool(identity[1]),
                "enabled": bool(pref and pref[0]),
                "telegram_configured": bool(token),
                "bot_username": bot,
                "telegram_linked": bool(
                    c.exec_driver_sql(
                        "SELECT 1 FROM telegram_links WHERE user_id=?", (actor,)
                    ).first()
                ),
                "push": [
                    dict(row)
                    for row in c.exec_driver_sql(
                        "SELECT id,label,active FROM push_subscriptions WHERE user_id=? ORDER BY created",
                        (actor,),
                    ).mappings()
                ],
                "deliveries": [
                    dict(row)
                    for row in c.exec_driver_sql(
                        "SELECT id,channel,state,attempts,updated,retry_at,error_code FROM notification_deliveries WHERE user_id=? ORDER BY updated DESC LIMIT 20",
                        (actor,),
                    ).mappings()
                ],
            }

    @app.patch(prefix)
    def preferences(body: PreferenceInput, s=Depends(session)):
        real_session(s)
        with s["store"].transaction() as c:
            c.exec_driver_sql(
                "INSERT INTO notification_preferences(user_id,enabled) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled",
                (s["user_id"], int(body.enabled)),
            )
        return {"ok": True}

    @app.post(prefix + "/push")
    def subscribe(body: PushInput, request: Request, s=Depends(session)):
        real_session(s)
        throttle(request, "push-subscribe", 30)
        info = validate_subscription(body.model_dump())
        actor, store = s["user_id"], s["store"]
        with store.transaction() as c:
            if not c.exec_driver_sql(
                "SELECT public_key FROM notification_identity WHERE id=1"
            ).scalar():
                raise ValueError("Владелец сервера ещё не настроил Web Push")
            existing = c.exec_driver_sql(
                "SELECT id,user_id FROM push_subscriptions WHERE endpoint_hash=?",
                (digest(body.endpoint),),
            ).first()
            if existing and existing[1] != actor:
                raise Denied("Устройство связано с другим аккаунтом. Отключите прежнюю подписку.")
            if (
                not existing
                and c.exec_driver_sql(
                    "SELECT count(*) FROM push_subscriptions WHERE user_id=?", (actor,)
                ).scalar()
                >= 10
            ):
                raise ValueError("Достигнут лимит 10 устройств. Отключите старое устройство.")
            record_id = existing[0] if existing else str(uuid.uuid4())
            c.exec_driver_sql(
                "INSERT INTO push_subscriptions(id,user_id,endpoint_hash,data,label,active,created) VALUES(?,?,?,?,?,1,?) ON CONFLICT(endpoint_hash) DO UPDATE SET data=excluded.data,label=excluded.label,active=1",
                (
                    record_id,
                    actor,
                    digest(body.endpoint),
                    dumps(info),
                    body.label.strip() or "Это устройство",
                    int(time.time()),
                ),
            )
            c.exec_driver_sql(
                "INSERT INTO notification_preferences(user_id,enabled) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET enabled=1",
                (actor,),
            )
        return {"id": record_id}

    @app.delete(prefix + "/push/{subscription_id}")
    def unsubscribe(subscription_id: str, s=Depends(session)):
        real_session(s)
        with s["store"].transaction() as c:
            row = c.exec_driver_sql(
                "SELECT user_id FROM push_subscriptions WHERE id=?", (subscription_id,)
            ).first()
            if not row or row[0] != s["user_id"]:
                raise Denied("Подписка недоступна")
            c.exec_driver_sql("DELETE FROM push_subscriptions WHERE id=?", (subscription_id,))
            c.exec_driver_sql(
                "UPDATE notification_deliveries SET state='cancelled' WHERE destination_id=? AND state IN ('ready','delayed')",
                (subscription_id,),
            )
        return {"ok": True}

    @app.post(prefix + "/push/current")
    def current_device(body: EndpointInput, s=Depends(session)):
        real_session(s)
        rows = s["store"].query(
            "SELECT id FROM push_subscriptions WHERE user_id=? AND endpoint_hash=? AND active=1",
            (s["user_id"], digest(body.endpoint)),
        )
        return {"id": rows[0]["id"] if rows else ""}

    @app.post(prefix + "/telegram/code")
    def link_code(request: Request, s=Depends(session)):
        real_session(s)
        throttle(request, "telegram-link", 10)
        if not telegram_config()[0]:
            raise ValueError("Владелец сервера ещё не настроил Telegram")
        code = "MASHINA-" + secrets.token_hex(12)
        expires = int(time.time()) + 600
        with s["store"].transaction() as c:
            c.exec_driver_sql(
                "INSERT INTO telegram_link_codes(user_id,code_hash,expires) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires",
                (s["user_id"], digest(code), expires),
            )
        return {"code": code, "expires": expires}

    @app.delete(prefix + "/telegram")
    def unlink(s=Depends(session)):
        real_session(s)
        with s["store"].transaction() as c:
            for table in ("telegram_links", "telegram_link_codes"):
                c.exec_driver_sql(f"DELETE FROM {table} WHERE user_id=?", (s["user_id"],))
            c.exec_driver_sql(
                "UPDATE notification_deliveries SET state='cancelled' WHERE user_id=? AND channel='telegram' AND state IN ('ready','delayed')",
                (s["user_id"],),
            )
        return {"ok": True}

    @app.post(prefix + "/deliveries/{delivery_id}/retry")
    def retry(delivery_id: str, body: RetryInput, request: Request, s=Depends(session)):
        real_session(s)
        throttle(request, "notification-retry", 10)
        if not body.acknowledge_duplicates:
            raise ValueError("Нужно подтвердить риск повторного уведомления")
        with s["store"].transaction() as c:
            row = (
                c.exec_driver_sql(
                    "SELECT * FROM notification_deliveries WHERE id=?", (delivery_id,)
                )
                .mappings()
                .first()
            )
            if not row or row["user_id"] != s["user_id"]:
                raise Denied("Попытка недоступна")
            if row["state"] not in {"rejected", "uncertain"}:
                raise ValueError("Эту попытку нельзя повторить")
        from backend.notification_delivery import due_targets

        if not any(
            item["id"] == delivery_id
            for item in due_targets(s["store"], int(time.time()), s["user_id"], row["reminder_id"])
        ):
            raise ValueError(
                "Напоминание или канал больше не активны. Проверьте срок, подписку и доступ."
            )
        with s["store"].transaction() as c:
            result = c.exec_driver_sql(
                "UPDATE notification_deliveries SET state='ready',auto_attempts=0,retry_at=0,error_code='',updated=? WHERE id=? AND state IN ('rejected','uncertain')",
                (int(time.time()), delivery_id),
            )
            if result.rowcount != 1:
                raise ValueError("Состояние попытки изменилось. Обновите список.")
        return {"ok": True}


def validate_notification_archive(connection):
    """Validate persisted secrets/bindings offline; never resolve or call providers."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from backend.notification_transport import b64

    identities = connection.execute(
        "SELECT id,private_key,public_key,paused,telegram_offset FROM notification_identity"
    ).fetchall()
    if (
        len(identities) != 1
        or identities[0][0] != 1
        or identities[0][3] not in (0, 1)
        or identities[0][4] < 0
    ):
        raise ValueError("Некорректная конфигурация уведомлений в архиве")
    _, private, public, _, _ = identities[0]
    if bool(private) != bool(public):
        raise ValueError("Неполная идентичность Web Push в архиве")
    if len(private) > 512 or len(public) > 128:
        raise ValueError("Некорректная длина ключа в архиве")
    if private:
        try:
            key = serialization.load_der_private_key(b64(private), password=None)
            if not isinstance(key, ec.EllipticCurvePrivateKey) or not isinstance(
                key.curve, ec.SECP256R1
            ):
                raise ValueError()
            if key.public_key().public_bytes(
                serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
            ) != b64(public):
                raise ValueError()
        except (ValueError, TypeError):
            raise ValueError("Повреждён ключ Web Push в архиве") from None
    for endpoint_hash, data in connection.execute(
        "SELECT endpoint_hash,data FROM push_subscriptions"
    ):
        info = validate_subscription(json.loads(data))
        if digest(info["endpoint"]) != endpoint_hash:
            raise ValueError("Повреждена подписка в архиве")
    for (chat,) in connection.execute("SELECT chat_id FROM telegram_links"):
        if not re.fullmatch(r"[1-9][0-9]{0,19}", chat):
            raise ValueError("Некорректная привязка Telegram в архиве")
    if connection.execute(
        "SELECT 1 FROM notification_preferences WHERE enabled NOT IN (0,1) LIMIT 1"
    ).fetchone():
        raise ValueError("Некорректные настройки уведомлений")
