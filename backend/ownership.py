"""Ownership tools: confirmed tire history, budgets, forecasts and reviewed CSV."""

import calendar
import csv
import hashlib
import io
import json
import re
import uuid
from datetime import date
from backend.domain import text, iso, integer, minor, currency, normalize_event


def month_value(value):
    value = str(value or "")
    if not re.fullmatch(r"\d{4}-\d{2}", value):
        raise ValueError("Месяц: ГГГГ-ММ")
    date.fromisoformat(value + "-01")
    return value


def normalize_ownership(entity, data):
    r = dict(data)
    if entity == "tire_set":
        for key in ("brand", "model", "size", "notes"):
            r[key] = text(
                r.get(key), maximum=2000 if key == "notes" else 100, required=key == "brand"
            )
        r["season"] = r.get("season", "summer")
        if r["season"] not in {"summer", "winter", "all"}:
            raise ValueError("Выберите сезон шин")
        intervals = r.get("intervals", [])
        if not isinstance(intervals, list) or len(intervals) > 200:
            raise ValueError("Не более 200 интервалов использования")
        previous_date, previous_km, total = "", 0, 0
        cleaned = []
        for index, interval in enumerate(intervals):
            if not isinstance(interval, dict):
                raise ValueError("Некорректный интервал")
            mounted = iso(interval.get("mounted_at"))[:10]
            km = integer(interval.get("mounted_km"))
            removed = iso(interval.get("removed_at"), True)[:10]
            end_km = (
                integer(interval["removed_km"])
                if interval.get("removed_km") not in (None, "")
                else None
            )
            if mounted > date.today().isoformat() or mounted < previous_date or km < previous_km:
                raise ValueError("Интервалы шин нарушают хронологию")
            if bool(removed) != (end_km is not None):
                raise ValueError("Для снятия укажите дату и пробег")
            if removed and (removed < mounted or removed > date.today().isoformat() or end_km < km):
                raise ValueError("Снятие должно быть после установки")
            if not removed and index != len(intervals) - 1:
                raise ValueError("Сначала закройте предыдущий интервал")
            if removed:
                total += end_km - km
            cleaned.append(
                {
                    "mounted_at": mounted,
                    "mounted_km": km,
                    "removed_at": removed,
                    "removed_km": end_km,
                }
            )
            previous_date, previous_km = removed or mounted, end_km if end_km is not None else km
        r.update(intervals=cleaned, confirmed_km=total)
    else:
        r["amount_minor"] = (
            minor(r["amount"])
            if "amount" in r
            else integer(r.get("amount_minor", 0), "Сумма", 10**12)
        )
        if not 0 <= r["amount_minor"] <= 10**12:
            raise ValueError("Недопустимая сумма")
        r["currency"] = currency(r.get("currency"))
        r["category"] = text(r.get("category"), maximum=300)
        if entity == "budget":
            r["month"] = month_value(r.get("month"))
        elif entity == "recurring_cost":
            r["title"] = text(r.get("title"), maximum=120, required=True)
            r["next_date"] = iso(r.get("next_date"))[:10]
            r["interval_months"] = integer(r.get("interval_months", 1), "Период", 120)
            if r["interval_months"] < 1:
                raise ValueError("Период не менее месяца")
            r["enabled"] = bool(r.get("enabled", True))
        else:
            raise ValueError("Неизвестный инструмент")
    return r


def shifted_date(origin, months):
    index = origin.year * 12 + origin.month - 1 + months
    year, month = divmod(index, 12)
    if not 1 <= year <= 9999:
        raise ValueError("Дата вне поддерживаемого диапазона")
    return date(year, month + 1, min(origin.day, calendar.monthrange(year, month + 1)[1]))


def ownership_report(state, vehicle_id, month):
    month = month_value(month)
    events = [
        e for e in state.get("events", []) if not e.get("deleted") and e["vehicle_id"] == vehicle_id
    ]
    budgets = []
    for budget in state.get("budgets", []):
        if budget.get("deleted") or budget["vehicle_id"] != vehicle_id or budget["month"] != month:
            continue
        actual = sum(
            e.get("amount_minor", 0)
            for e in events
            if e["occurred_at"].startswith(month)
            and e.get("currency", "RUB") == budget["currency"]
            and (not budget.get("category") or e.get("category") == budget["category"])
        )
        budgets.append(
            {**budget, "actual_minor": actual, "remaining_minor": budget["amount_minor"] - actual}
        )
    start = date.fromisoformat(month + "-01")
    finish = shifted_date(start, 12)
    forecast = []
    for recurring in state.get("recurring_costs", []):
        if (
            recurring.get("deleted")
            or recurring["vehicle_id"] != vehicle_id
            or not recurring.get("enabled", True)
        ):
            continue
        origin = date.fromisoformat(recurring["next_date"])
        interval = recurring["interval_months"]
        elapsed = (start.year - origin.year) * 12 + start.month - origin.month
        offset = max(0, elapsed // interval - 1)
        for count in range(offset, offset + 14):
            occurrence = shifted_date(origin, count * interval)
            if occurrence >= finish:
                break
            if occurrence >= start:
                forecast.append({**recurring, "date": occurrence.isoformat(), "planned": True})
    parts = []
    for event in events:
        if event["kind"] == "maintenance":
            for index, item in enumerate(event.get("items", [])):
                parts.append(
                    {
                        **item,
                        "event_id": event["id"],
                        "index": index,
                        "occurred_at": event["occurred_at"],
                        "odometer": event.get("odometer"),
                        "currency": event.get("currency", "RUB"),
                    }
                )
    maintenance_due = [
        r
        for r in state.get("reminders", [])
        if r["vehicle_id"] == vehicle_id
        and not r.get("deleted")
        and r.get("enabled", True)
        and not r.get("completed_at")
        and (
            r.get("due_odometer") is not None
            or (r.get("due_date") and r["due_date"] < finish.isoformat())
        )
    ]
    return {
        "budgets": budgets,
        "maintenance_due": maintenance_due,
        "forecast": sorted(forecast, key=lambda r: r["date"]),
        "parts": sorted(parts, key=lambda r: r["occurred_at"], reverse=True),
    }


CSV_COLUMNS = {
    "external_id",
    "occurred_at",
    "kind",
    "amount",
    "description",
    "category",
    "odometer",
    "currency",
    "liters",
    "price",
    "full",
    "gap",
    "fuel",
    "station",
    "vendor",
    "tags",
}


def import_row(source, owner, vehicle_id):
    if not isinstance(source, dict) or set(source) - CSV_COLUMNS:
        raise ValueError("Неподдерживаемые колонки CSV")
    source = {k: text(v, maximum=4000) for k, v in source.items()}
    canonical = json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    identity = source.get("external_id") or hashlib.sha256(canonical.encode()).hexdigest()
    record_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"mashina-csv:{owner}:{vehicle_id}:{identity}"))
    data = {k: v for k, v in source.items() if k != "external_id"}
    for key in ("full", "gap"):
        if key in data:
            if data[key].lower() not in {"", "0", "1", "true", "false", "да", "нет"}:
                raise ValueError("Признак бака/пропуска: 1 или 0")
            data[key] = data[key].lower() in {"1", "true", "да"}
    data["vehicle_id"] = vehicle_id
    if data.get("kind") in {"expense", "maintenance"} and not data.get("amount"):
        raise ValueError("Для расхода нужна сумма")
    normalized = normalize_event(data)
    normalized["import_fingerprint"] = hashlib.sha256(canonical.encode()).hexdigest()
    return {"id": record_id, "operation_id": record_id, "source": source, "data": normalized}


def csv_rows(blob, owner, vehicle_id):
    if len(blob) > 2 * 1024 * 1024:
        raise ValueError("CSV превышает 2 МБ")
    try:
        content = blob.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("Сохраните CSV в UTF-8") from None
    delimiter = ";" if ";" in content.partition("\n")[0] else ","
    reader = csv.DictReader(io.StringIO(content, newline=""), delimiter=delimiter)
    headers = reader.fieldnames or []
    if (
        len(headers) != len(set(headers))
        or not {"occurred_at", "kind"} <= set(headers)
        or set(headers) - CSV_COLUMNS
    ):
        raise ValueError("Нужны колонки occurred_at, kind; неизвестные/повторные колонки запрещены")
    result, seen = [], set()
    try:
        for index, source in enumerate(reader, 1):
            if index > 1000:
                raise ValueError("Не более 1000 строк")
            try:
                row = import_row(source, owner, vehicle_id)
                if row["id"] in seen:
                    row["duplicate"] = True
                seen.add(row["id"])
                result.append({**row, "line": index + 1})
            except (ValueError, TypeError):
                result.append(
                    {
                        "line": index + 1,
                        "source": source,
                        "error": "Проверьте дату, тип, сумму, пробег и поля заправки",
                    }
                )
    except csv.Error:
        raise ValueError("Некорректная структура CSV") from None
    return result
