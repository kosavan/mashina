"""Follow a vehicle's active renewal using an existing reminder record."""

from datetime import datetime, timezone
import json

from fastapi import Depends, HTTPException, Response


RENEWAL_TYPES = ("registration", "insurance")
LEAD_DAYS = (7, 14, 30)


def latest_renewal(c, vehicle_id, renewal_type):
    row = c.exec_driver_sql(
        """SELECT id, data FROM events
        WHERE vehicle_id=? AND deleted=0 AND json_extract(data,'$.kind')='expense'
        AND json_extract(data,'$.renewal.type')=?
        ORDER BY json_extract(data,'$.occurred_at') DESC,
                 json_extract(data,'$.renewal.expires_on') DESC, id LIMIT 1""",
        (vehicle_id, renewal_type),
    ).first()
    return {**json.loads(row[1]), "id": row[0]} if row else None


def renewal_cycle(event):
    return f'{event["id"]}:{event["renewal"]["expires_on"]}' if event else ""


def validate_schedule(c, vehicle_id, record_id, data, before, action):
    schedule = data.get("renewal_schedule")
    previous = (before or {}).get("renewal_schedule")
    if schedule is None and not previous:
        data.pop("renewal_schedule", None)
        return
    if (
        not isinstance(schedule, dict)
        or set(schedule) != {"type", "lead_days"}
        or schedule["type"] not in RENEWAL_TYPES
        or type(schedule["lead_days"]) is not int
        or schedule["lead_days"] not in LEAD_DAYS
        or (previous and previous["type"] != schedule["type"])
    ):
        raise ValueError("Выберите срок предупреждения о продлении")
    event = latest_renewal(c, vehicle_id, schedule["type"])
    if not event and not previous:
        raise ValueError("Сначала добавьте действующую запись о продлении")
    if action != "delete" and c.exec_driver_sql(
        """SELECT 1 FROM reminders WHERE vehicle_id=? AND id<>? AND deleted=0
        AND json_extract(data,'$.renewal_schedule.type')=? LIMIT 1""",
        (vehicle_id, record_id, schedule["type"]),
    ).first():
        from backend.storage import Conflict

        raise Conflict("Напоминание об этом продлении уже настроено")
    data.update(
        due_date=event["renewal"]["expires_on"] if event else before["due_date"],
        due_odometer=None,
        repeat_days=0,
        repeat_km=0,
        warning_days=schedule["lead_days"],
        warning_km=0,
    )
    return event


def project_renewal(reminder, event):
    """Derive the schedule without rewriting records or their optimistic versions."""
    cycle = renewal_cycle(event)
    return {
        **reminder,
        "due_date": event["renewal"]["expires_on"] if event else "",
        "renewal_cycle": cycle,
        "renewal_active": bool(cycle),
        "renewal_completed_at": reminder.get("completed_at", ""),
        "completed_at": (
            reminder.get("completed_at", "")
            if cycle and cycle == reminder.get("renewal_completed_for")
            else ""
        ),
    }


def install_renewal_calendar(app, session):
    @app.get("/api/v1/renewals/{event_id}/calendar")
    def get_calendar(event_id: str, s=Depends(session)):
        from backend.access import event_access
        from backend.storage import uid

        store, actor = s["store"], s["user_id"]
        with store.transaction() as c:
            row = event_access(c, uid(event_id), actor)
            record = json.loads(row["data"])
            renewal = record.get("renewal") or {}
            renewal_type = renewal.get("type")
            if row["deleted"] or renewal_type not in RENEWAL_TYPES:
                raise HTTPException(404, "Запись о продлении недоступна")
            settings = c.exec_driver_sql(
                "SELECT settings FROM users WHERE id=?", (actor,)
            ).scalar_one()
        russian = (json.loads(settings or "{}").get("locale") or "ru") == "ru"
        title = {
            "registration": "Продлить регистрацию" if russian else "Registration renewal",
            "insurance": "Продлить страховку" if russian else "Insurance renewal",
        }[renewal_type]
        ics = "\r\n".join(
            (
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//MASHINA//Vehicle renewals//EN",
                "BEGIN:VEVENT",
                f'UID:{row["id"]}@mashina',
                f"DTSTAMP:{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
                f'DTSTART;VALUE=DATE:{renewal["expires_on"].replace("-", "")}',
                f"SUMMARY:{title}",
                "END:VEVENT",
                "END:VCALENDAR",
                "",
            )
        )
        return Response(
            ics,
            media_type="text/calendar",
            headers={"Content-Disposition": 'attachment; filename="mashina-renewal.ics"'},
        )
