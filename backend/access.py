"""Default-deny policies. Call within the transaction that reads or changes data."""

import json
from backend.storage import Denied


def get_row(c, table, record_id):
    row = c.exec_driver_sql(f"SELECT * FROM {table} WHERE id=?", (record_id,)).mappings().first()
    if not row:
        raise Denied("Запись недоступна")
    return dict(row)


def vehicle_access(c, vehicle_id, actor, write=False):
    active = c.exec_driver_sql("SELECT id FROM users WHERE id=? AND disabled=0", (actor,)).first()
    if not active:
        raise Denied("Учётная запись отключена")
    car = get_row(c, "vehicles", vehicle_id)
    role = "owner" if car["owner_id"] == actor else None
    if not role:
        row = c.exec_driver_sql(
            "SELECT role FROM vehicle_access WHERE vehicle_id=? AND user_id=?", (vehicle_id, actor)
        ).first()
        role = row[0] if row else None
    if not role or (write and role != "owner"):
        raise Denied("Нет доступа к этому действию с автомобилем")
    return car, role


def event_access(c, event_id, actor, write=False):
    row = get_row(c, "events", event_id)
    _, role = vehicle_access(c, row["vehicle_id"], actor)
    if write and role != "owner" and row["created_by"] != actor:
        raise Denied("Водитель может изменять только собственные записи")
    return row


def upload_access(c, vehicle_id, event_id, actor):
    car, role = vehicle_access(c, vehicle_id, actor)
    if event_id:
        row = event_access(c, event_id, actor, write=True)
        if row["vehicle_id"] != vehicle_id or row["deleted"]:
            raise Denied("Документ относится к недоступному событию")
    elif role != "owner":
        raise Denied("Прикрепите документ к своей записи")
    return car


def attachment_access(c, attachment_id, actor, write=False):
    row = get_row(c, "attachments", attachment_id)
    car, role = vehicle_access(c, row["vehicle_id"], actor)
    own = row["created_by"] == actor
    if role != "owner" and not own and (write or row["visibility"] != "shared"):
        raise Denied("Документ недоступен")
    if write and role != "owner" and json.loads(car["data"]).get("photo_id") == attachment_id:
        raise Denied("Обложку изменяет владелец автомобиля")
    return row, role


def mutation_access(c, actor, entity, action, record_id, data):
    """Return existing record and resource owner; never trust incoming identity fields."""
    if entity in {"settings", "category"}:
        row = None
        if entity == "category" and action != "create":
            row = get_row(c, "categories", record_id)
            if row["owner_id"] != actor:
                raise Denied("Категория недоступна")
        return row, actor
    table = {
        "vehicle": "vehicles",
        "event": "events",
        "reminder": "reminders",
        "tire_set": "tire_sets",
        "budget": "budgets",
        "recurring_cost": "recurring_costs",
    }.get(entity)
    if not table:
        raise ValueError("Неизвестная сущность")
    row = get_row(c, table, record_id) if action != "create" else None
    if entity == "vehicle":
        if row:
            vehicle_access(c, record_id, actor, write=True)
        return row, row["owner_id"] if row else actor
    vehicle_id = row["vehicle_id"] if row else data.get("vehicle_id")
    car, role = vehicle_access(c, vehicle_id, actor, write=entity != "event")
    if row and entity == "event" and role != "owner" and row["created_by"] != actor:
        raise Denied("Водитель может изменять только собственные записи")
    return row, car["owner_id"]
