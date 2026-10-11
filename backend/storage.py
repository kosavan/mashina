"""SQLAlchemy 2 Core storage, serialized WAL transactions and mutation receipts."""

from contextlib import contextmanager
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from threading import RLock
import uuid

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event as sa_event
from sqlalchemy.pool import StaticPool

from backend.domain import (
    normalize_vehicle,
    normalize_event,
    normalize_reminder,
    current_odometer,
    reminder_status,
    text,
    iso,
    integer,
)

TABLES = {
    "vehicle": "vehicles",
    "event": "events",
    "category": "categories",
    "reminder": "reminders",
}


class Conflict(ValueError):
    pass


class Denied(ValueError):
    pass


def dumps(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def uid(value):
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        raise ValueError("Некорректный идентификатор") from None


def row_data(row):
    result = json.loads(row["data"])
    result.update(id=row["id"], version=row["version"], deleted=bool(row["deleted"]))
    if "vehicle_id" in row:
        result["vehicle_id"] = row["vehicle_id"]
    return result


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.mkdir(parents=True, exist_ok=True)
        self.uploads = self.path / "uploads"
        self.uploads.mkdir(exist_ok=True)
        self.lock = RLock()
        if os.getenv("MASHINA_PRODUCTION") == "1" and sqlite3.sqlite_version_info < (3, 51, 3):
            raise RuntimeError("Production WAL requires SQLite 3.51.3+; rebuild the provided image")
        self.engine = create_engine(
            f"sqlite:///{(self.path / 'mashina.db').as_posix()}",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @sa_event.listens_for(self.engine, "connect")
        def configure(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=FULL")

        with self.lock, self.engine.begin() as connection:
            cfg = Config()
            cfg.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
            cfg.attributes["connection"] = connection
            command.upgrade(cfg, "head")

    @contextmanager
    def transaction(self):
        with self.lock, self.engine.begin() as c:
            yield c

    def query(self, sql, params=()):
        with self.lock, self.engine.connect() as c:
            return [dict(row) for row in c.exec_driver_sql(sql, params).mappings()]

    def owned(self, c, table, record_id, owner):
        row = (
            c.exec_driver_sql(
                f"SELECT * FROM {table} WHERE id=? AND owner_id=?", (record_id, owner)
            )
            .mappings()
            .first()
        )
        if row is None:
            raise Denied("Запись недоступна")
        return dict(row)

    def state(self, owner):
        result = {}
        for table in TABLES.values():
            result[table] = [
                row_data(r) for r in self.query(f"SELECT * FROM {table} WHERE owner_id=?", (owner,))
            ]
        result["attachments"] = [
            {
                **json.loads(r["data"]),
                "id": r["id"],
                "vehicle_id": r["vehicle_id"],
                "event_id": r["event_id"],
            }
            for r in self.query("SELECT * FROM attachments WHERE owner_id=?", (owner,))
        ]
        users = self.query("SELECT settings FROM users WHERE id=?", (owner,))
        result["settings"] = json.loads(users[0]["settings"]) if users else {}
        for v in result["vehicles"]:
            v["current_odometer"] = current_odometer(v, result["events"])
        for r in result["reminders"]:
            car = next((v for v in result["vehicles"] if v["id"] == r["vehicle_id"]), {})
            r.update(reminder_status(r, car.get("current_odometer", 0)))
        return result

    def mutate(self, owner, payload):
        operation_id, record_id = uid(payload["operation_id"]), uid(payload["id"])
        entity, action = payload["entity"], payload["action"]
        digest = hashlib.sha256(dumps(payload).encode()).hexdigest()
        with self.transaction() as c:
            prior = (
                c.exec_driver_sql(
                    "SELECT * FROM receipts WHERE owner_id=? AND operation_id=?",
                    (owner, operation_id),
                )
                .mappings()
                .first()
            )
            if prior:
                if prior["payload_hash"] != digest:
                    raise Conflict("Этот идентификатор операции уже использован с другими данными")
                return json.loads(prior["response"])
            if entity == "settings":
                settings = {
                    k: v
                    for k, v in payload["data"].items()
                    if k in {"theme", "locale", "units", "last_vehicle", "last_category"}
                }
                c.exec_driver_sql(
                    "UPDATE users SET settings=? WHERE id=?", (dumps(settings), owner)
                )
                response = {"record": settings}
            else:
                if entity not in TABLES:
                    raise ValueError("Неизвестная сущность")
                table = TABLES[entity]
                before = None
                data = dict(payload.get("data") or {})
                if action != "create":
                    existing = self.owned(c, table, record_id, owner)
                    before = row_data(existing)
                    if payload.get("expected_version") != existing["version"]:
                        raise Conflict(
                            "Запись изменена на другом устройстве. Выберите версию для сохранения."
                        )
                    data = {**before, **data}
                elif c.exec_driver_sql(f"SELECT id FROM {table} WHERE id=?", (record_id,)).first():
                    raise Conflict("Запись с таким идентификатором уже существует")
                version = before["version"] + 1 if before else 1
                deleted = bool(before and before.get("deleted"))
                if action == "delete":
                    if entity == "vehicle":
                        raise ValueError("Автомобиль можно архивировать, история не удаляется")
                    deleted = True
                elif action == "restore":
                    deleted = False
                elif action == "complete" and entity == "reminder":
                    from datetime import date

                    done = iso(data.get("completion_date") or date.today().isoformat())[:10]
                    km = integer(data.get("completion_odometer"))
                    if data.get("repeat_days") or data.get("repeat_km"):
                        if data.get("repeat_days"):
                            data["due_date"] = (
                                (datetime.fromisoformat(done) + timedelta(days=data["repeat_days"]))
                                .date()
                                .isoformat()
                            )
                        if data.get("repeat_km"):
                            data["due_odometer"] = km + data["repeat_km"]
                        data["completed_at"] = ""
                    else:
                        data["completed_at"] = done
                elif action not in {"create", "update"}:
                    raise ValueError("Неизвестное действие")
                data.pop("current_odometer", None)
                if entity in {"event", "reminder"}:
                    vehicle_id = uid(data.get("vehicle_id"))
                    self.owned(c, "vehicles", vehicle_id, owner)
                    if before and vehicle_id != before["vehicle_id"]:
                        raise ValueError("Перенос записи между автомобилями не поддерживается")
                if entity == "vehicle":
                    data = normalize_vehicle(data)
                    if data.get("photo_id"):
                        image = self.owned(c, "attachments", data["photo_id"], owner)
                        if not json.loads(image["data"]).get("media_type", "").startswith("image/"):
                            raise ValueError("Обложка должна быть изображением")
                        if image["vehicle_id"] != record_id:
                            raise ValueError("Фото относится к другому автомобилю")
                elif entity == "event":
                    data = normalize_event(data)
                    if (
                        data.get("odometer") is not None
                        and not data.get("odometer_confirmed")
                        and not deleted
                    ):
                        self.validate_odometer(c, owner, record_id, data)
                elif entity == "reminder":
                    data = normalize_reminder(data)
                else:
                    data["name"] = text(data.get("name"), maximum=80, required=True)
                    if data.get("parent_id"):
                        if data["parent_id"] == record_id:
                            raise ValueError("Категория не может быть своим родителем")
                        parent = self.owned(c, "categories", data["parent_id"], owner)
                        if json.loads(parent["data"]).get("parent_id"):
                            raise ValueError("Поддерживается один уровень подкатегорий")
                data.update(id=record_id, version=version, deleted=deleted)
                if before:
                    c.exec_driver_sql(
                        f"UPDATE {table} SET data=?,version=?,deleted=? WHERE id=?",
                        (dumps(data), version, int(deleted), record_id),
                    )
                else:
                    cols = "id,owner_id,version,data,deleted"
                    args = [record_id, owner, version, dumps(data), int(deleted)]
                    if entity in {"event", "reminder"}:
                        cols += ",vehicle_id"
                        args.append(vehicle_id)
                    c.exec_driver_sql(
                        f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' for _ in args)})",
                        tuple(args),
                    )
                c.exec_driver_sql(
                    "INSERT INTO audit(owner_id,entity_id,action,occurred_at,before_data,after_data) VALUES(?,?,?,?,?,?)",
                    (
                        owner,
                        record_id,
                        action,
                        datetime.now().isoformat(),
                        dumps(before),
                        dumps(data),
                    ),
                )
                response = {"record": data}
            c.exec_driver_sql(
                "INSERT INTO receipts VALUES(?,?,?,?)",
                (owner, operation_id, digest, dumps(response)),
            )
            return response

    def validate_odometer(self, c, owner, record_id, data):
        car = row_data(self.owned(c, "vehicles", data["vehicle_id"], owner))
        readings = [(car.get("purchase_date") or "0001-01-01", car.get("purchase_odometer", 0))]
        for row in c.exec_driver_sql(
            "SELECT * FROM events WHERE vehicle_id=? AND deleted=0 AND id<>?",
            (data["vehicle_id"], record_id),
        ).mappings():
            e = row_data(row)
            if e.get("odometer") is not None:
                readings.append((e["occurred_at"], e["odometer"]))
        earlier = [km for d, km in readings if d <= data["occurred_at"]]
        later = [km for d, km in readings if d > data["occurred_at"]]
        if (earlier and data["odometer"] < max(earlier)) or (
            later and data["odometer"] > min(later)
        ):
            raise ValueError(
                "Пробег нарушает хронологию. Проверьте показание и подтвердите осознанное исправление."
            )

    def close(self):
        with self.lock:
            self.engine.dispose()
