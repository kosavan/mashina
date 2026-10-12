"""Validate machine metadata in an untrusted backup before activating its database."""

import json
import re
import uuid

from backend.machine_models import project_record


def identifier(value):
    if not isinstance(value, str) or str(uuid.UUID(value)) != value:
        raise ValueError("Некорректный идентификатор интеграции в архиве")


def digest(value):
    if not isinstance(value, str) or not re.fullmatch("[0-9a-f]{64}", value):
        raise ValueError("Некорректный проверочный хеш интеграции в архиве")


def validate_machine_archive(c):
    credentials = {}
    for row in c.execute(
        "SELECT id,user_id,token_hash,label,created,expires,revoked,write_enabled FROM machine_credentials"
    ):
        key, user, verifier, label, created, expires, revoked, write = row
        identifier(key)
        identifier(user)
        digest(verifier)
        if not isinstance(label, str) or not 1 <= len(label) <= 80 or label.strip() != label:
            raise ValueError("Некорректное название ключа в архиве")
        if (
            type(created) is not int
            or type(expires) is not int
            or not 0 < created < expires <= created + 31536000
            or (revoked is not None and (type(revoked) is not int or revoked < created))
            or write not in (0, 1)
        ):
            raise ValueError("Некорректный срок или права ключа в архиве")
        credentials[key] = user
    grants = set(c.execute("SELECT credential_id,vehicle_id FROM machine_vehicle_grants"))
    for key, car in grants:
        identifier(key)
        identifier(car)
        if key not in credentials:
            raise ValueError("Неизвестный ключ интеграции в архиве")
    for key in credentials:
        if not 1 <= sum(k == key for k, _ in grants) <= 50:
            raise ValueError("Некорректный набор автомобилей ключа в архиве")
    for key, operation, car, entity, record, payload_hash, response, created in c.execute(
        "SELECT * FROM machine_receipts"
    ):
        for value in (key, operation, car, record):
            identifier(value)
        digest(payload_hash)
        if (
            (key, car) not in grants
            or entity not in {"event", "reminder"}
            or type(created) is not int
            or created <= 0
        ):
            raise ValueError("Несогласованная операция интеграции в архиве")
        value = json.loads(response)
        if (
            not isinstance(value, dict)
            or set(value) != {"record"}
            or not isinstance(value["record"], dict)
        ):
            raise ValueError("Некорректный ответ интеграции в архиве")
        item = value["record"]
        if (
            project_record(entity, item) != item
            or item.get("id") != record
            or item.get("vehicle_id") != car
            or type(item.get("version")) is not int
            or item["version"] < 1
        ):
            raise ValueError("Недопустимые данные в ответе интеграции")
        table = "events" if entity == "event" else "reminders"
        if not c.execute(
            f"SELECT 1 FROM {table} WHERE id=? AND vehicle_id=?", (record, car)
        ).fetchone():
            raise ValueError("Операция интеграции ссылается на отсутствующую запись")
