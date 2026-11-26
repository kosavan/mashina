"""Service concerns use vehicle notes and close through a maintenance record."""

import json

from backend.access import event_access
from backend.domain import text
from backend.storage import uid


def normalize_service_visit(connection, record_id, actor, data, before, deleted):
    concern = data.pop("service_concern", None)
    if concern is not None and type(concern) is not bool:
        raise ValueError("Некорректная отметка о задаче для СТО")
    if concern:
        if data["kind"] != "note":
            raise ValueError("Задача для СТО должна быть заметкой")
        data["description"] = text(data["description"], maximum=240, required=True)
        data["service_concern"] = True

    visit = data.pop("service_visit", None)
    previous = (before or {}).get("service_visit") or {}
    if not deleted and visit is None:
        return
    if deleted:
        if previous:
            data["service_visit"] = previous
        return
    if data["kind"] != "maintenance" or not isinstance(visit, dict):
        raise ValueError("Итог визита относится к записи обслуживания")
    if set(visit) - {"concern_ids", "concerns", "follow_up"}:
        raise ValueError("Проверьте данные визита на СТО")
    raw_ids = visit.get("concern_ids", [])
    if not isinstance(raw_ids, list) or len(raw_ids) > 20:
        raise ValueError("Можно связать до 20 задач за один визит")
    concern_ids = list(dict.fromkeys(uid(value) for value in raw_ids))
    follow_up = text(visit.get("follow_up"), maximum=1500)
    if not concern_ids and not follow_up:
        return

    saved = {item["id"]: item for item in previous.get("concerns", [])}
    if concern_ids and (
        concern_ids != previous.get("concern_ids") or (before or {}).get("deleted")
    ):
        active_links = connection.exec_driver_sql(
            """SELECT 1 FROM events, json_each(events.data, '$.service_visit.concern_ids') AS link
               WHERE events.vehicle_id=? AND events.deleted=0 AND events.id<>?
                 AND link.value IN (SELECT value FROM json_each(?)) LIMIT 1""",
            (data["vehicle_id"], record_id, json.dumps(concern_ids)),
        ).first()
        if active_links:
            raise ValueError("Задача уже закрыта другим визитом")

    snapshots = []
    for concern_id in concern_ids:
        if concern_id in saved:
            snapshots.append(saved[concern_id])
            continue
        row = event_access(connection, concern_id, actor, write=True)
        note = json.loads(row["data"])
        if (
            row["vehicle_id"] != data["vehicle_id"]
            or row["deleted"]
            or not note.get("service_concern")
        ):
            raise ValueError("Выберите открытую задачу этого автомобиля")
        snapshots.append({"id": concern_id, "description": note["description"]})

    data["service_visit"] = {
        "concern_ids": concern_ids,
        "concerns": snapshots,
        "follow_up": follow_up,
    }
