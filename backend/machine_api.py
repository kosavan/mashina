"""Separate browser credential management and bearer-only read boundary."""

import os
import time
import base64
import hashlib
import json
from datetime import date

from fastapi import Depends, Request, Query

from backend.domain import analytics, reminder_status, KINDS
from backend.storage import Denied, row_data, uid, dumps
from backend.machine_access import CredentialInput, authorize, issue, metadata, audit
from backend.machine_models import (
    project_record,
    ANALYTICS_FIELDS,
    MutationInput,
    EventInput,
    ReminderInput,
    CompletionInput,
)


def period(start, end):
    for value in (start, end):
        if value:
            if date.fromisoformat(value).isoformat() != value:
                raise ValueError("Укажите дату в формате ГГГГ-ММ-ДД")
    if start and end and start > end:
        raise ValueError("Начало периода позже конца")


def odometer(c, car):
    observed = c.exec_driver_sql(
        "SELECT max(CAST(json_extract(data,'$.odometer') AS INTEGER)) FROM events WHERE vehicle_id=? AND deleted=0",
        (car["id"],),
    ).scalar()
    return max(car.get("purchase_odometer", 0), observed or 0)


def cursor_encode(binding, position):
    return base64.urlsafe_b64encode(dumps([binding, position]).encode()).decode().rstrip("=")


def cursor_decode(value, binding):
    if not value:
        return None
    try:
        decoded = json.loads(
            base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        )
        if (
            not isinstance(decoded, list)
            or len(decoded) != 2
            or decoded[0] != binding
            or not isinstance(decoded[1], list)
            or len(decoded[1]) != 2
        ):
            raise ValueError()
        occurred, record = decoded[1]
        if not isinstance(occurred, str) or len(occurred) > 40:
            raise ValueError()
        return occurred, uid(record)
    except (ValueError, TypeError, UnicodeError):
        raise ValueError("Курсор страницы недействителен; начните с первой страницы") from None


def install_machine(app, session):
    app.state.machine_enabled = os.getenv("MASHINA_API_ENABLED") == "1"
    management = "/api/v1/machine/credentials"
    machine = "/api/machine/v1"

    @app.get(machine + "/openapi.json", include_in_schema=False)
    def contract(request: Request):
        from fastapi.openapi.utils import get_openapi

        with app.state.store.transaction() as c:
            authorize(c, request.headers.get("Authorization", ""), app.state.machine_enabled)
        document = get_openapi(
            title="MASHINA scoped machine API",
            version="1",
            routes=[
                route
                for route in app.routes
                if getattr(route, "path", "").startswith(machine + "/")
            ],
        )
        document.setdefault("components", {}).setdefault("securitySchemes", {})["MachineBearer"] = {
            "type": "http",
            "scheme": "bearer",
        }
        document["security"] = [{"MachineBearer": []}]
        schemas = document["components"].setdefault("schemas", {})
        for model in (EventInput, ReminderInput, CompletionInput):
            schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
            schemas.update(schema.pop("$defs", {}))
            schemas[model.__name__] = schema
        if "MutationInput" in schemas:
            schemas["MutationInput"]["properties"]["data"] = {
                "anyOf": [
                    {"$ref": "#/components/schemas/EventInput"},
                    {"$ref": "#/components/schemas/ReminderInput"},
                    {"$ref": "#/components/schemas/CompletionInput"},
                ]
            }
            schemas["MutationInput"]["allOf"] = [
                {
                    "if": {
                        "properties": {
                            "entity": {"const": entity},
                            "action": {"enum": ["upsert", "delete"]},
                        }
                    },
                    "then": {"properties": {"data": {"$ref": "#/components/schemas/" + model}}},
                }
                for entity, model in (("event", "EventInput"), ("reminder", "ReminderInput"))
            ]
            schemas["MutationInput"]["allOf"].append(
                {
                    "if": {"properties": {"action": {"const": "complete"}}},
                    "then": {
                        "required": ["base_version", "data"],
                        "properties": {
                            "entity": {"const": "reminder"},
                            "base_version": {"minimum": 1},
                            "data": {"$ref": "#/components/schemas/CompletionInput"},
                        },
                    },
                }
            )
        return document

    def enabled(s):
        if s["demo"] or not app.state.machine_enabled:
            raise Denied(
                "Доступ интеграций отключён. Владелец сервера может включить MASHINA_API_ENABLED."
            )

    @app.get(management)
    def credentials(s=Depends(session)):
        if s["demo"]:
            return {"enabled": False, "credentials": []}
        with s["store"].transaction() as c:
            rows = c.exec_driver_sql(
                "SELECT * FROM machine_credentials WHERE user_id=? ORDER BY created DESC,id",
                (s["user_id"],),
            ).mappings()
            return {
                "enabled": app.state.machine_enabled,
                "credentials": [metadata(c, row) for row in rows],
            }

    @app.post(management)
    def create_credential(body: CredentialInput, s=Depends(session)):
        enabled(s)
        with s["store"].transaction() as c:
            return issue(c, s["user_id"], body)

    @app.delete(management + "/{credential_id}")
    def revoke_credential(credential_id: str, s=Depends(session)):
        # Revocation remains available while the feature is disabled.
        if s["demo"]:
            raise Denied("Демо-режим не выдаёт ключи интеграций")
        with s["store"].transaction() as c:
            row = c.exec_driver_sql(
                "SELECT id FROM machine_credentials WHERE id=? AND user_id=?",
                (uid(credential_id), s["user_id"]),
            ).first()
            if not row:
                raise Denied("Ключ недоступен")
            changed = c.exec_driver_sql(
                "UPDATE machine_credentials SET revoked=? WHERE id=? AND revoked IS NULL",
                (int(time.time()), row[0]),
            ).rowcount
            if changed:
                audit(c, s["user_id"], row[0], "machine_revoke", {})
        return {"ok": True}

    @app.get(machine + "/vehicles")
    def vehicles(request: Request):
        with app.state.store.transaction() as c:
            key = authorize(c, request.headers.get("Authorization", ""), app.state.machine_enabled)
            cars = c.exec_driver_sql(
                "SELECT vehicles.* FROM vehicles JOIN machine_vehicle_grants ON vehicle_id=vehicles.id WHERE credential_id=? AND owner_id=? AND deleted=0 ORDER BY vehicles.id",
                (key["id"], key["user_id"]),
            ).mappings()
            result = []
            for raw in cars:
                car = row_data(raw)
                result.append(
                    {
                        **{
                            k: car.get(k)
                            for k in (
                                "id",
                                "version",
                                "name",
                                "brand",
                                "model",
                                "year",
                                "status",
                                "currency",
                                "purchase_odometer",
                            )
                        },
                        "current_odometer": odometer(c, car),
                    }
                )
            return result

    @app.get(machine + "/vehicles/{vehicle_id}/history")
    def history(
        vehicle_id: str,
        request: Request,
        limit: int = Query(25, ge=1, le=100),
        cursor: str = Query("", max_length=1024),
        search: str = Query("", max_length=200),
        kind: str = Query("", max_length=20),
        start: str = Query("", max_length=10),
        end: str = Query("", max_length=10),
    ):
        vehicle_id = uid(vehicle_id)
        with app.state.store.transaction() as c:
            authorize(
                c, request.headers.get("Authorization", ""), app.state.machine_enabled, vehicle_id
            )
            period(start, end)
            if kind and kind not in KINDS:
                raise ValueError("Неизвестный тип события")
            binding = hashlib.sha256(
                dumps([vehicle_id, search, kind, start, end]).encode()
            ).hexdigest()
            position = cursor_decode(cursor, binding)
            clauses = ["vehicle_id=?", "deleted=0"]
            args = [vehicle_id]
            expression = "json_extract(data,'$.occurred_at')"
            if position:
                clauses.append(f"({expression},id)<(?,?)")
                args.extend(position)
            if start:
                clauses.append(f"{expression}>=?")
                args.append(start)
            if end:
                clauses.append(f"{expression}<?")
                args.append(end + "T99")
            if kind:
                clauses.append("json_extract(data,'$.kind')=?")
                args.append(kind)
            if search:
                # Search only allowed human text; private extension fields cannot leak through matching.
                pattern = (
                    "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
                )
                clauses.append(
                    "((coalesce(json_extract(data,'$.description'),'') || ' ' || coalesce(json_extract(data,'$.category'),'') || ' ' || coalesce(json_extract(data,'$.vendor'),'')) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(events.data,'$.items') AS part WHERE (coalesce(json_extract(part.value,'$.name'),'') || ' ' || coalesce(json_extract(part.value,'$.part_number'),'')) LIKE ? ESCAPE '\\'))"
                )
                args.extend([pattern, pattern])
            rows = list(
                c.exec_driver_sql(
                    f"SELECT * FROM events WHERE {' AND '.join(clauses)} ORDER BY {expression} DESC,id DESC LIMIT ?",
                    tuple(args + [limit + 1]),
                ).mappings()
            )
            items = [project_record("event", row_data(row)) for row in rows[:limit]]
            next_cursor = (
                cursor_encode(binding, [items[-1]["occurred_at"], items[-1]["id"]])
                if len(rows) > limit
                else None
            )
            return {"items": items, "next_cursor": next_cursor}

    @app.get(machine + "/vehicles/{vehicle_id}/reminders")
    def reminders(
        vehicle_id: str,
        request: Request,
        limit: int = Query(25, ge=1, le=100),
        after: str = Query("", max_length=36),
    ):
        vehicle_id = uid(vehicle_id)
        after = uid(after) if after else ""
        with app.state.store.transaction() as c:
            key = authorize(
                c, request.headers.get("Authorization", ""), app.state.machine_enabled, vehicle_id
            )
            car = row_data(
                c.exec_driver_sql(
                    "SELECT * FROM vehicles WHERE id=? AND owner_id=?", (vehicle_id, key["user_id"])
                )
                .mappings()
                .one()
            )
            km = odometer(c, car)
            rows = list(
                c.exec_driver_sql(
                    "SELECT * FROM reminders WHERE vehicle_id=? AND deleted=0 AND id>? ORDER BY id LIMIT ?",
                    (vehicle_id, after, limit + 1),
                ).mappings()
            )
            items = []
            for raw in rows[:limit]:
                record = row_data(raw)
                items.append(project_record("reminder", {**record, **reminder_status(record, km)}))
            return {"items": items, "next_after": items[-1]["id"] if len(rows) > limit else None}

    @app.get(machine + "/vehicles/{vehicle_id}/analytics")
    def financials(
        vehicle_id: str,
        request: Request,
        start: str = Query("", max_length=10),
        end: str = Query("", max_length=10),
        currency: str = Query("RUB", pattern="^[A-Z]{3}$"),
    ):
        vehicle_id = uid(vehicle_id)
        with app.state.store.transaction() as c:
            authorize(
                c, request.headers.get("Authorization", ""), app.state.machine_enabled, vehicle_id
            )
            period(start, end)
            car = row_data(
                c.exec_driver_sql("SELECT * FROM vehicles WHERE id=?", (vehicle_id,))
                .mappings()
                .one()
            )
            rows = list(
                c.exec_driver_sql(
                    "SELECT * FROM events WHERE vehicle_id=? AND deleted=0 LIMIT 20001",
                    (vehicle_id,),
                ).mappings()
            )
            if len(rows) > 20000:
                raise ValueError(
                    "Аналитика интеграции поддерживает до 20 000 событий автомобиля; используйте приложение для большого архива"
                )
            result = analytics(
                [car], [row_data(row) for row in rows], start, end, currency_code=currency
            )
            return {key: result[key] for key in ANALYTICS_FIELDS if key in result}

    @app.post(machine + "/vehicles/{vehicle_id}/mutations")
    def mutation(vehicle_id: str, body: MutationInput, request: Request):
        from backend.machine_access import mutate_machine

        with app.state.store.transaction() as c:
            key = authorize(
                c,
                request.headers.get("Authorization", ""),
                app.state.machine_enabled,
                uid(vehicle_id),
                write=True,
            )
            return mutate_machine(c, app.state.store, key, uid(vehicle_id), body)
