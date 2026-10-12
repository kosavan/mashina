"""Exterior condition is descriptive evidence, never a financial/odometer event."""

from datetime import date
import json
import uuid

from backend.domain import currency, decimal, integer, iso, minor, text

PANELS = {
    "front": {"hood", "windshield", "front_bumper", "left_headlight", "right_headlight"},
    "rear": {"trunk", "rear_glass", "rear_bumper", "left_taillight", "right_taillight"},
    "top": {"hood", "windshield", "roof", "rear_glass", "trunk"},
}
for side in ("left", "right"):
    PANELS[side] = {
        f"{side}_{part}"
        for part in (
            "front_fender",
            "rear_fender",
            "front_door",
            "rear_door",
            "sill",
            "mirror",
            "glass",
        )
    }
STATUSES = {"observed", "needs_repair", "planned", "repaired", "monitoring"}
TYPES = {"scratch", "dent", "chip", "corrosion", "crack", "other"}
SEVERITIES = {"minor", "moderate", "major"}


def identifier(value):
    return str(uuid.UUID(str(value)))


def normalize_damage(data):
    if not isinstance(data, dict):
        raise ValueError("Некорректные поля повреждения")
    view, panel = data.get("view"), data.get("panel")
    if not isinstance(view, str) or view not in PANELS:
        raise ValueError("Выберите вид кузова")
    if not isinstance(panel, str) or panel not in PANELS[view]:
        raise ValueError("Деталь не относится к выбранному виду кузова")
    r = {"vehicle_id": identifier(data.get("vehicle_id")), "view": view, "panel": panel}
    for name in ("x", "y"):
        value = decimal(data.get(name), "Координата отметки")
        if not 0 <= value <= 1:
            raise ValueError("Отметка должна находиться внутри схемы")
        r[name] = round(float(value), 4)
    r["title"] = text(data.get("title"), maximum=120, required=True)
    r["notes"] = text(data.get("notes"), maximum=4000)
    for name, choices, default in (
        ("damage_type", TYPES, "scratch"),
        ("severity", SEVERITIES, "minor"),
        ("status", STATUSES, "observed"),
    ):
        value = data.get(name, default)
        if not isinstance(value, str) or value not in choices:
            raise ValueError("Выберите допустимый тип, серьёзность и статус повреждения")
        r[name] = value
    r["discovered_on"] = iso(data.get("discovered_on"))[:10]
    r["repaired_on"] = iso(data.get("repaired_on"), True)[:10]
    if r["discovered_on"] > date.today().isoformat() or r["repaired_on"] > date.today().isoformat():
        raise ValueError("Дата повреждения или ремонта не может быть в будущем")
    if r["repaired_on"] and r["repaired_on"] < r["discovered_on"]:
        raise ValueError("Ремонт не может быть раньше обнаружения повреждения")
    r["odometer"] = integer(data["odometer"]) if data.get("odometer") not in (None, "") else None
    r["currency"] = currency(data.get("currency"))
    if "estimate" in data:
        r["estimate_minor"] = (
            minor(data["estimate"]) if data["estimate"] not in (None, "") else None
        )
    else:
        r["estimate_minor"] = (
            integer(data["estimate_minor"], "Оценка ремонта", 1000000000000)
            if data.get("estimate_minor") is not None
            else None
        )
    if r["estimate_minor"] is not None and r["estimate_minor"] < 0:
        raise ValueError("Оценка ремонта не может быть отрицательной")
    r["maintenance_event_id"] = (
        identifier(data["maintenance_event_id"]) if data.get("maintenance_event_id") else ""
    )
    photos = data.get("photos", [])
    if not isinstance(photos, list) or len(photos) > 20:
        raise ValueError("Не более 20 фотографий повреждения")
    r["photos"], seen = [], set()
    for photo in photos:
        if not isinstance(photo, dict) or photo.get("phase") not in {"before", "after"}:
            raise ValueError("Укажите фото до или после ремонта")
        aid = identifier(photo.get("attachment_id"))
        if aid in seen:
            raise ValueError("Фотография уже прикреплена")
        seen.add(aid)
        r["photos"].append({"attachment_id": aid, "phase": photo["phase"]})
    return r


def validate_damage_links(connection, data, actor, before=None):
    from backend.access import attachment_access
    from backend.storage import Denied

    before = before or {}
    event_id = data["maintenance_event_id"]
    if event_id:
        row = (
            connection.exec_driver_sql(
                "SELECT vehicle_id,data,deleted FROM events WHERE id=?", (event_id,)
            )
            .mappings()
            .first()
        )
        prior_link = event_id == before.get("maintenance_event_id")
        if row is None:
            if not prior_link:
                raise ValueError("Запись обслуживания недоступна")
        elif (
            row["vehicle_id"] != data["vehicle_id"]
            or json.loads(row["data"]).get("kind") != "maintenance"
            or (row["deleted"] and not prior_link)
        ):
            raise ValueError("Выберите действующее обслуживание этого автомобиля")
    prior_photos = {p["attachment_id"] for p in before.get("photos", [])}
    for photo in data["photos"]:
        aid = photo["attachment_id"]
        exists = connection.exec_driver_sql("SELECT id FROM attachments WHERE id=?", (aid,)).first()
        if not exists and aid in prior_photos:
            continue  # Explicitly deleted evidence remains an honest historical reference.
        try:
            row, _ = attachment_access(connection, aid, actor)
        except Denied:
            raise ValueError("Фотография повреждения недоступна") from None
        if row["vehicle_id"] != data["vehicle_id"] or not json.loads(row["data"]).get(
            "media_type", ""
        ).startswith("image/"):
            raise ValueError("Выберите изображение этого автомобиля")


def validate_body_archive(connection):
    """SQLite restore validation; unavailable deleted evidence is allowed, foreign links are not."""
    for rid, vehicle_id, owner, version, deleted, raw in connection.execute(
        "SELECT id,vehicle_id,owner_id,version,deleted,data FROM body_damages"
    ):
        data = json.loads(raw)
        normalized = normalize_damage(data)
        if (
            identifier(rid) != rid
            or data.get("id") != rid
            or data.get("version") != version
            or bool(data.get("deleted")) != bool(deleted)
            or normalized["vehicle_id"] != vehicle_id
        ):
            raise ValueError("Несогласованная запись повреждения")
        if any(data.get(key) != value for key, value in normalized.items()):
            raise ValueError("Некорректные поля повреждения")
        car = connection.execute(
            "SELECT owner_id FROM vehicles WHERE id=?", (vehicle_id,)
        ).fetchone()
        if not car or car[0] != owner:
            raise ValueError("Несогласованный владелец повреждения")
        history = data.get("status_history")
        if not isinstance(history, list) or not history or len(history) > 10000:
            raise ValueError("Некорректная история повреждения")
        for step in history:
            if not isinstance(step, dict) or step.get("status") not in STATUSES:
                raise ValueError("Некорректная история повреждения")
            iso(step.get("changed_at"))
            iso(step.get("repaired_on"), True)
        if history[-1]["status"] != data["status"]:
            raise ValueError("История повреждения не соответствует статусу")
        event_id = data["maintenance_event_id"]
        if event_id:
            event = connection.execute(
                "SELECT vehicle_id FROM events WHERE id=?", (event_id,)
            ).fetchone()
            if event and event[0] != vehicle_id:
                raise ValueError("Ремонт связан с другим автомобилем")
        for photo in data["photos"]:
            image = connection.execute(
                "SELECT vehicle_id,data FROM attachments WHERE id=?", (photo["attachment_id"],)
            ).fetchone()
            if image and (
                image[0] != vehicle_id
                or not json.loads(image[1]).get("media_type", "").startswith("image/")
            ):
                raise ValueError(
                    "Фото повреждения относится к другому автомобилю или не является изображением"
                )
