"""Pure, exact vehicle-history calculations. No persistence or HTTP dependencies."""

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re

CATEGORIES = [
    "Топливо",
    "Плановое ТО",
    "Ремонт",
    "Запчасти",
    "Шины и диски",
    "Страхование",
    "Налоги",
    "Мойка и детейлинг",
    "Парковки и дороги",
    "Штрафы",
    "Аксессуары",
    "Прочее",
]
KINDS = {"expense", "fuel", "maintenance", "odometer", "note"}


def decimal(value, name="Значение", positive=False):
    try:
        result = Decimal(str(value).replace(",", "."))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{name}: требуется число") from None
    if not result.is_finite() or abs(result) > Decimal("10000000000"):
        raise ValueError(f"{name}: недопустимое число")
    if positive and result <= 0:
        raise ValueError(f"{name} должно быть больше нуля")
    return result


def minor(value):
    return int((decimal(value) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def integer(value, name="Пробег", maximum=3000000):
    n = decimal(value, name)
    if n != int(n) or n < 0 or n > maximum:
        raise ValueError(f"{name}: целое число от 0 до {maximum}")
    return int(n)


def text(value, name="Название", maximum=100, required=False):
    value = str(value or "").strip()
    if len(value) > maximum or (required and not value):
        raise ValueError(f"{name}: от {1 if required else 0} до {maximum} символов")
    return value


def iso(value, optional=False):
    if not value and optional:
        return ""
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.isoformat(timespec="seconds")
    except (ValueError, TypeError):
        raise ValueError("Укажите корректную дату") from None


def currency(value):
    result = str(value or "RUB").upper()
    if not re.fullmatch("[A-Z]{3}", result):
        raise ValueError("Валюта: трёхбуквенный код")
    return result


def normalize_vehicle(data):
    r = dict(data)
    r["name"] = text(r.get("name"), required=True)
    for key in (
        "brand",
        "model",
        "generation",
        "trim",
        "plate",
        "vin",
        "engine",
        "transmission",
        "drive",
        "fuel",
        "notes",
        "photo_id",
    ):
        r[key] = text(r.get(key), maximum=2000 if key == "notes" else 100)
    if r.get("year"):
        r["year"] = integer(r["year"], "Год", date.today().year + 1)
        if r["year"] < 1886:
            raise ValueError("Год выпуска должен быть не ранее 1886")
    r["purchase_odometer"] = integer(r.get("purchase_odometer", 0))
    r["currency"] = currency(r.get("currency"))
    for key in ("purchase", "sale"):
        if key + "_amount" in r:
            r[key + "_minor"] = minor(r[key + "_amount"] or 0)
        if r.get(key + "_minor", 0) < 0:
            raise ValueError("Цена не может быть отрицательной")
        r[key + "_date"] = iso(r.get(key + "_date"), True)[:10]
    r["status"] = r.get("status", "active")
    if r["status"] not in {"active", "archived", "sold"}:
        raise ValueError("Неизвестный статус автомобиля")
    return r


def normalize_event(data):
    r = dict(data)
    if r.get("kind") not in KINDS:
        raise ValueError("Неизвестный тип записи")
    r["occurred_at"] = iso(r.get("occurred_at"))
    if r["occurred_at"][:10] > date.today().isoformat():
        raise ValueError("Будущее событие: используйте напоминание")
    r["currency"] = currency(r.get("currency"))
    for key in ("description", "vendor", "payment", "tags", "station", "fuel", "category"):
        r[key] = text(r.get(key), maximum=4000 if key == "description" else 300)
    r["odometer"] = integer(r["odometer"]) if r.get("odometer") not in (None, "") else None
    if r["kind"] in {"fuel", "odometer"} and r["odometer"] is None:
        raise ValueError("Для этой записи нужен пробег")
    items = []
    for item in r.get("items", []):
        qty = decimal(item.get("quantity", "1"), "Количество", True)
        price = decimal(item.get("unit_price", "0"), "Цена")
        discount = decimal(item.get("discount", "0"), "Скидка")
        if price < 0 or discount < 0 or discount > qty * price:
            raise ValueError("Некорректная цена или скидка позиции")
        items.append(
            {
                "name": text(item.get("name"), required=True, maximum=200),
                "part_number": text(item.get("part_number"), maximum=100),
                "quantity": str(qty),
                "unit_price": str(price),
                "discount": str(discount),
                "amount_minor": minor(qty * price - discount),
            }
        )
    if len(items) > 100:
        raise ValueError("Не более 100 позиций")
    r["items"] = items
    if r["kind"] == "fuel":
        values = {
            k: decimal(r[k], k, True)
            for k in ("liters", "price", "amount")
            if r.get(k) not in (None, "")
        }
        if len(values) < 2:
            raise ValueError("Заполните любые два: литры, цена литра, сумма")
        liters = values.get("liters")
        price = values.get("price")
        amount = values.get("amount")
        if liters is None:
            liters = (amount / price).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        if price is None:
            price = (amount / liters).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if len(values) == 3 and abs(minor(liters * price) - minor(amount)) > 1:
            raise ValueError("Литры, цена и сумма не совпадают")
        r.update(
            liters=str(liters),
            price=str(price),
            amount_minor=minor(amount if amount is not None else liters * price),
            full=bool(r.get("full")),
            gap=bool(r.get("gap")),
            category="Топливо",
        )
    elif r["kind"] in {"expense", "maintenance"}:
        adjustment = minor(r.get("adjustment", "0") or "0")
        r["amount_minor"] = (
            sum(i["amount_minor"] for i in items) + adjustment
            if items
            else minor(r.get("amount", "0") or "0")
        )
        r["category"] = r["category"] or ("Плановое ТО" if r["kind"] == "maintenance" else "Прочее")
    else:
        r["amount_minor"] = 0
    if not 0 <= r["amount_minor"] <= 10**12:
        raise ValueError("Сумма должна быть от 0 до 10 млрд")
    if r["kind"] == "note" and not r["description"]:
        raise ValueError("Введите текст заметки")
    r["amount"] = str(Decimal(r["amount_minor"]) / 100)
    return r


def normalize_reminder(data):
    r = dict(data)
    r["title"] = text(r.get("title"), maximum=120, required=True)
    r["due_date"] = iso(r.get("due_date"), True)[:10]
    r["due_odometer"] = (
        integer(r["due_odometer"]) if r.get("due_odometer") not in (None, "") else None
    )
    if not r["due_date"] and r["due_odometer"] is None:
        raise ValueError("Укажите дату или пробег напоминания")
    for key, default in (
        ("warning_days", 30),
        ("warning_km", 1000),
        ("repeat_days", 0),
        ("repeat_km", 0),
    ):
        r[key] = integer(r.get(key, default) or 0, key)
    r["enabled"] = bool(r.get("enabled", True))
    return r


def current_odometer(vehicle, events):
    return max(
        [vehicle.get("purchase_odometer", 0)]
        + [
            e["odometer"]
            for e in events
            if not e.get("deleted")
            and e.get("vehicle_id") == vehicle.get("id")
            and e.get("odometer") is not None
        ]
    )


def reminder_status(reminder, odometer, today=None):
    today = date.fromisoformat(today or date.today().isoformat())
    km = reminder["due_odometer"] - odometer if reminder.get("due_odometer") is not None else None
    days = (
        (date.fromisoformat(reminder["due_date"][:10]) - today).days
        if reminder.get("due_date")
        else None
    )
    status = "normal"
    if (km is not None and km <= 0) or (days is not None and days <= 0):
        status = "overdue"
    elif (km is not None and km <= reminder.get("warning_km", 1000)) or (
        days is not None and days <= reminder.get("warning_days", 30)
    ):
        status = "soon"
    if not reminder.get("enabled", True):
        status = "disabled"
    if reminder.get("completed_at"):
        status = "completed"
    return {"status": status, "remaining_km": km, "remaining_days": days}


def fuel_cycles(events):
    groups = defaultdict(list)
    for e in events:
        if e.get("kind") == "fuel" and not e.get("deleted"):
            groups[e.get("vehicle_id", "")].append(e)
    result = []
    for rows in groups.values():
        base, liters, cost = None, Decimal(0), 0
        for e in sorted(rows, key=lambda e: e["occurred_at"]):
            if e.get("gap") or (
                base
                and (base.get("fuel") != e.get("fuel") or base.get("currency") != e.get("currency"))
            ):
                base, liters, cost = None, Decimal(0), 0
            if base:
                liters += decimal(e["liters"])
                cost += e["amount_minor"]
                distance = e["odometer"] - base["odometer"]
                if e.get("full"):
                    if distance > 0:
                        result.append(
                            {
                                "vehicle_id": e.get("vehicle_id"),
                                "currency": e.get("currency", "RUB"),
                                "date": e["occurred_at"][:10],
                                "distance": distance,
                                "liters": float(liters),
                                "consumption": round(float(liters * 100 / distance), 2),
                                "cost_minor": cost,
                            }
                        )
                    base, liters, cost = e, Decimal(0), 0
            elif e.get("full"):
                base = e
    return sorted(result, key=lambda c: c["date"])


def analytics(vehicles, events, start="", end="", category="", kind="", currency_code="RUB"):
    active = [e for e in events if not e.get("deleted")]
    selected = [
        e
        for e in active
        if (not start or e["occurred_at"][:10] >= start)
        and (not end or e["occurred_at"][:10] <= end)
        and (not category or e.get("category") == category)
        and (not kind or e["kind"] == kind)
        and e.get("currency", "RUB") == currency_code
    ]
    months, cats, years, cars = (
        defaultdict(int),
        defaultdict(int),
        defaultdict(int),
        defaultdict(int),
    )
    for e in selected:
        amount = e.get("amount_minor", 0)
        months[e["occurred_at"][:7]] += amount
        cats[e.get("category") or "Прочее"] += amount
        years[e["occurred_at"][:4]] += amount
        cars[e.get("vehicle_id")] += amount
    total = sum(e.get("amount_minor", 0) for e in selected)
    distance, distance_known = 0, True
    for v in vehicles:
        readings = [(v.get("purchase_date") or "0001-01-01", v.get("purchase_odometer", 0))]
        readings += [
            (e["occurred_at"][:10], e["odometer"])
            for e in active
            if e.get("vehicle_id") == v["id"] and e.get("odometer") is not None
        ]
        readings.sort()
        before = [r for r in readings if not start or r[0] <= start]
        within = [
            r
            for r in readings
            if (not end or r[0] <= end) and r[0] >= (v.get("purchase_date") or "0001-01-01")
        ]
        baseline = before[-1][1] if start and before else v.get("purchase_odometer", 0)
        if (start and not before) or not within or max(r[1] for r in within) < baseline:
            distance_known = False
        else:
            distance += max(r[1] for r in within) - baseline
    cycles = fuel_cycles(active)
    cycles = [
        c
        for c in cycles
        if c["currency"] == currency_code
        and (not start or c["date"] >= start)
        and (not end or c["date"] <= end)
    ]
    fuel = [e for e in selected if e["kind"] == "fuel"]
    liters = sum((decimal(e["liters"]) for e in fuel), Decimal(0))
    fuel_total = sum(e["amount_minor"] for e in fuel)
    cycle_km = sum(c["distance"] for c in cycles)
    dates = [e["occurred_at"][:10] for e in selected]
    first = start or (min(dates) if dates else date.today().isoformat())
    last = end or date.today().isoformat()
    span = max(1, (date.fromisoformat(last) - date.fromisoformat(first)).days + 1)
    purchases = sum(
        v.get("purchase_minor", 0) for v in vehicles if v.get("currency", "RUB") == currency_code
    )
    sales = sum(
        v.get("sale_minor", 0) for v in vehicles if v.get("currency", "RUB") == currency_code
    )
    trend = []
    accumulated = 0
    for month in sorted(months):
        accumulated += months[month]
        cutoff = month + "-31"
        observed, known = 0, True
        for vehicle in vehicles:
            readings = [
                (vehicle.get("purchase_date") or "0001-01-01", vehicle.get("purchase_odometer", 0))
            ]
            readings += [
                (e["occurred_at"][:10], e["odometer"])
                for e in active
                if e.get("vehicle_id") == vehicle["id"] and e.get("odometer") is not None
            ]
            baseline_rows = sorted(r for r in readings if not start or r[0] <= start)
            end_rows = [
                r
                for r in readings
                if r[0] <= cutoff and r[0] >= (vehicle.get("purchase_date") or "0001-01-01")
            ]
            baseline = (
                baseline_rows[-1][1]
                if start and baseline_rows
                else vehicle.get("purchase_odometer", 0)
            )
            if (start and not baseline_rows) or not end_rows:
                known = False
            else:
                observed += max(0, max(r[1] for r in end_rows) - baseline)
        trend.append(
            {
                "name": month,
                "cost": float(
                    (Decimal(accumulated) / 100 / observed).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                )
                if known and observed
                else None,
            }
        )
    return {
        "total_minor": total,
        "cost_trend": trend,
        "fuel_minor": fuel_total,
        "maintenance_minor": sum(
            e["amount_minor"]
            for e in selected
            if e["kind"] == "maintenance" or e.get("category") == "Ремонт"
        ),
        "mileage": distance if distance_known and distance > 0 else None,
        "cost_per_km": round(total / 100 / distance, 2)
        if distance_known and distance > 0
        else None,
        "average_month_minor": int(
            (Decimal(total) * Decimal("30.4375") / span).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        ),
        "average_year_minor": int(
            (Decimal(total) * Decimal("365.25") / span).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        ),
        "average_liter_price": round(float(Decimal(fuel_total) / 100 / liters), 2)
        if liters
        else None,
        "consumption": round(sum(c["liters"] for c in cycles) * 100 / cycle_km, 2)
        if cycle_km
        else None,
        "fuel_cost_per_km": round(sum(c["cost_minor"] for c in cycles) / 100 / cycle_km, 2)
        if cycle_km
        else None,
        "purchase_minor": purchases,
        "sale_minor": sales,
        "ownership_minor": total + purchases - sales,
        "months": [{"name": k, "amount": v / 100} for k, v in sorted(months.items())],
        "categories": [
            {"name": k, "amount": v / 100}
            for k, v in sorted(cats.items(), key=lambda x: -x[1])
            if v
        ],
        "years": [{"name": k, "amount": v / 100} for k, v in sorted(years.items())],
        "cars": [{"name": v["name"], "amount": cars[v["id"]] / 100} for v in vehicles],
        "cycles": cycles,
        "fuel_prices": [
            {"date": e["occurred_at"][:10], "price": float(decimal(e["price"]))}
            for e in sorted(fuel, key=lambda e: e["occurred_at"])
        ],
        "currency": currency_code,
        "missing_reason": "Недостаточно подтверждённых показаний пробега на границах периода"
        if not distance_known or distance == 0
        else "",
    }
