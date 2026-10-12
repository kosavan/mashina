"""Original-owner credentials; callers keep authorization and work in one transaction."""

from datetime import datetime, timezone
import hashlib
import secrets
import time
import uuid
import json

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.storage import Conflict, Denied, dumps
from backend.storage import row_data
from backend.domain import normalize_event
from backend.machine_models import project_record


class CredentialInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    label: str = Field(min_length=1, max_length=80)
    vehicle_ids: list[str] = Field(min_length=1, max_length=50)
    expires_days: int = Field(default=90, ge=1, le=365)
    write_enabled: bool = False

    @field_validator("label")
    @classmethod
    def clean_label(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Укажите название ключа")
        return value

    @field_validator("vehicle_ids")
    @classmethod
    def clean_ids(cls, values):
        result = [str(uuid.UUID(value)) for value in values]
        if len(result) != len(set(result)):
            raise ValueError("Выберите разные автомобили")
        return result


def audit(c, user, credential, action, metadata):
    c.exec_driver_sql(
        "INSERT INTO audit(owner_id,entity_id,action,occurred_at,after_data) VALUES(?,?,?,?,?)",
        (user, credential, action, datetime.now(timezone.utc).isoformat(), dumps(metadata)),
    )


def metadata(c, row):
    result = {key: row[key] for key in ("id", "label", "created", "expires", "revoked")}
    result["write_enabled"] = bool(row["write_enabled"])
    result["vehicle_ids"] = [
        r[0]
        for r in c.exec_driver_sql(
            "SELECT vehicle_id FROM machine_vehicle_grants WHERE credential_id=? ORDER BY vehicle_id",
            (row["id"],),
        )
    ]
    return result


def require_user(c, user):
    if not c.exec_driver_sql("SELECT 1 FROM users WHERE id=? AND disabled=0", (user,)).first():
        raise Denied("Учётная запись недоступна")


def original_car(c, user, car_id):
    car = (
        c.exec_driver_sql(
            "SELECT * FROM vehicles WHERE id=? AND owner_id=? AND deleted=0", (car_id, user)
        )
        .mappings()
        .first()
    )
    if not car:
        raise Denied("Автомобиль недоступен исходному владельцу")
    return car


def issue(c, user, body):
    require_user(c, user)
    now = int(time.time())
    count = c.exec_driver_sql(
        "SELECT count(*) FROM machine_credentials WHERE user_id=? AND revoked IS NULL AND expires>?",
        (user, now),
    ).scalar_one()
    if count >= 10:
        raise Conflict("Достигнут лимит: отзовите один из десяти действующих ключей")
    for car in body.vehicle_ids:
        original_car(c, user, car)
    key_id = str(uuid.uuid4())
    secret = "msh_" + secrets.token_urlsafe(32)
    c.exec_driver_sql(
        "INSERT INTO machine_credentials VALUES(?,?,?,?,?,?,NULL,?)",
        (
            key_id,
            user,
            hashlib.sha256(secret.encode()).hexdigest(),
            body.label,
            now,
            now + body.expires_days * 86400,
            int(body.write_enabled),
        ),
    )
    for car in body.vehicle_ids:
        c.exec_driver_sql("INSERT INTO machine_vehicle_grants VALUES(?,?)", (key_id, car))
    audit(
        c,
        user,
        key_id,
        "machine_issue",
        {"vehicle_ids": body.vehicle_ids, "write_enabled": body.write_enabled},
    )
    row = (
        c.exec_driver_sql("SELECT * FROM machine_credentials WHERE id=?", (key_id,))
        .mappings()
        .one()
    )
    return {**metadata(c, row), "secret": secret}


def revoke_user(c, user):
    c.exec_driver_sql(
        "UPDATE machine_credentials SET revoked=? WHERE user_id=? AND revoked IS NULL",
        (int(time.time()), user),
    )


def authorize(c, authorization, enabled, vehicle_id=None, write=False):
    # Never echo the header or candidate token in errors or persistence.
    if not enabled or authorization[:7].lower() != "bearer " or len(authorization) > 128:
        raise HTTPException(
            401, "Ключ интеграции недействителен", headers={"WWW-Authenticate": "Bearer"}
        )
    candidate = authorization[7:]
    row = (
        c.exec_driver_sql(
            "SELECT machine_credentials.* FROM machine_credentials JOIN users ON users.id=user_id WHERE token_hash=? AND revoked IS NULL AND expires>? AND users.disabled=0",
            (hashlib.sha256(candidate.encode()).hexdigest(), int(time.time())),
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(
            401, "Ключ интеграции недействителен", headers={"WWW-Authenticate": "Bearer"}
        )
    if write and not row["write_enabled"]:
        raise Denied("Ключ разрешает только чтение")
    if vehicle_id is not None:
        if not c.exec_driver_sql(
            "SELECT 1 FROM machine_vehicle_grants WHERE credential_id=? AND vehicle_id=?",
            (row["id"], vehicle_id),
        ).first():
            raise Denied("Автомобиль не включён в доступ ключа")
        original_car(c, row["user_id"], vehicle_id)
    return row


MUTATION_NAMESPACE = uuid.UUID("06c76ebe-aa53-454b-a8e2-5c8fc10477d3")


def mutate_machine(c, store, key, vehicle_id, body):
    payload = body.model_dump(mode="json")
    digest = hashlib.sha256(dumps(payload).encode()).hexdigest()
    table = "events" if body.entity == "event" else "reminders"
    existing = c.exec_driver_sql(f"SELECT * FROM {table} WHERE id=?", (body.id,)).mappings().first()
    if existing and existing["vehicle_id"] != vehicle_id:
        raise Denied("Запись относится к другому автомобилю")
    prior = (
        c.exec_driver_sql(
            "SELECT * FROM machine_receipts WHERE credential_id=? AND operation_id=?",
            (key["id"], body.operation_id),
        )
        .mappings()
        .first()
    )
    if prior:
        if prior["payload_hash"] != digest or prior["vehicle_id"] != vehicle_id:
            raise Conflict("Идентификатор операции уже использован с другими данными")
        # Projection applies on first response and replay, even to a restored receipt.
        return {"record": project_record(body.entity, json.loads(prior["response"])["record"])}
    action = (
        body.action
        if body.action in {"delete", "complete"}
        else "create"
        if body.base_version == 0
        else "update"
    )
    if action != "create" and not existing:
        raise Denied("Запись недоступна")
    if existing and existing["deleted"] and action != "delete":
        raise Conflict("Запись удалена; восстановите её в приложении")
    data = {**body.data, "vehicle_id": vehicle_id}
    if body.entity == "event" and action != "delete":
        before = row_data(existing) if existing else {}
        combined = {**before, **data}
        # A prior browser-confirmed correction must not authorize a later machine correction.
        normalized = normalize_event(combined)
        changed_reading = not existing or any(
            normalized.get(field) != before.get(field)
            for field in ("odometer", "occurred_at", "kind")
        )
        if normalized.get("odometer") is not None and changed_reading:
            store.validate_odometer(c, key["user_id"], body.id, normalized)
    internal = str(uuid.uuid5(MUTATION_NAMESPACE, key["id"] + ":" + body.operation_id))
    result = store.mutate(
        key["user_id"],
        {
            "operation_id": internal,
            "entity": body.entity,
            "id": body.id,
            "action": action,
            "expected_version": body.base_version,
            "data": data,
        },
        connection=c,
    )
    projected = {"record": project_record(body.entity, result["record"])}
    c.exec_driver_sql(
        "INSERT INTO machine_receipts VALUES(?,?,?,?,?,?,?,?)",
        (
            key["id"],
            body.operation_id,
            vehicle_id,
            body.entity,
            body.id,
            digest,
            dumps(projected),
            int(time.time()),
        ),
    )
    audit(
        c,
        key["user_id"],
        key["id"],
        "machine_mutation",
        {"vehicle_id": vehicle_id, "entity": body.entity, "record_id": body.id},
    )
    return projected
