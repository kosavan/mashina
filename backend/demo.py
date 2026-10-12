"""Entirely synthetic fixture data in separate per-session databases."""

from datetime import date, timedelta
import uuid


def seed(store):
    owner = str(uuid.uuid4())
    with store.transaction() as c:
        c.exec_driver_sql(
            "INSERT INTO users(id,username,password_hash,settings) VALUES(?,?,?,?)",
            (owner, "Демо-гараж", "!no-login", "{}"),
        )
    today = date.today()
    cars = [
        ("Volvo XC60", "Volvo", "XC60", 2021, 48320, "А777АА 777", "petrol", "volvo-demo.webp"),
        (
            "Porsche 911",
            "Porsche",
            "911 Carrera",
            2019,
            22150,
            "М911ММ 197",
            "petrol",
            "porsche-demo.webp",
        ),
    ]
    for idx, (name, brand, model, year, base, plate, fuel, image) in enumerate(cars):
        vehicle_id = str(uuid.uuid4())
        vehicle = {
            "name": name,
            "brand": brand,
            "model": model,
            "year": year,
            "plate": plate,
            "purchase_odometer": base,
            "purchase_date": (today - timedelta(days=360)).isoformat(),
            "purchase_amount": "4200000" if idx == 0 else "8500000",
            "currency": "RUB",
            "engine": "2.0 · 249 л.с." if idx == 0 else "3.0 · 385 л.с.",
            "transmission": "Автомат",
            "drive": "Полный" if idx == 0 else "Задний",
            "fuel": "АИ-95" if idx == 0 else "АИ-100",
            "demo_image": image,
        }
        store.mutate(
            owner,
            {
                "operation_id": str(uuid.uuid4()),
                "entity": "vehicle",
                "action": "create",
                "id": vehicle_id,
                "data": vehicle,
            },
        )
        for month in range(8):
            for fill in range(3):
                days = 230 - month * 29 - fill * 8
                km = base + (month * 3 + fill) * (470 if idx == 0 else 320)
                data = {
                    "vehicle_id": vehicle_id,
                    "kind": "fuel",
                    "occurred_at": (today - timedelta(days=days)).isoformat(),
                    "odometer": km,
                    "liters": str(42 + (month + fill) % 7),
                    "price": str(64 + month * 0.7 + idx * 9),
                    "fuel": vehicle["fuel"],
                    "station": "Лукойл" if fill % 2 else "Газпромнефть",
                    "full": fill != 1,
                    "description": "Заправка · вымышленные данные",
                }
                store.mutate(
                    owner,
                    {
                        "operation_id": str(uuid.uuid4()),
                        "entity": "event",
                        "action": "create",
                        "id": str(uuid.uuid4()),
                        "data": data,
                    },
                )
            data = {
                "vehicle_id": vehicle_id,
                "kind": "maintenance" if month % 3 == 0 else "expense",
                "occurred_at": (today - timedelta(days=230 - month * 29 - 20)).isoformat(),
                "description": "Замена масла и фильтров"
                if month % 3 == 0
                else "Бережная мойка кузова",
                "category": "Плановое ТО" if month % 3 == 0 else "Мойка и детейлинг",
                "amount": str((18500 + idx * 16000) if month % 3 == 0 else 2200),
                "vendor": "Специализированный сервис",
                "items": [
                    {
                        "name": "Моторное масло",
                        "part_number": "DEMO-5W30",
                        "quantity": "6",
                        "unit_price": "1800",
                    },
                    {"name": "Масляный фильтр", "part_number": "DEMO-FILTER", "unit_price": "2400"},
                    {"name": "Работы", "unit_price": "5300"},
                ]
                if month % 3 == 0
                else [],
            }
            store.mutate(
                owner,
                {
                    "operation_id": str(uuid.uuid4()),
                    "entity": "event",
                    "action": "create",
                    "id": str(uuid.uuid4()),
                    "data": data,
                },
            )
        current = store.state(owner)["vehicles"][-1]["current_odometer"]
        for title, days, offset in [
            ("Замена моторного масла", 18, 750),
            ("Продлить ОСАГО", 65, None),
        ]:
            store.mutate(
                owner,
                {
                    "operation_id": str(uuid.uuid4()),
                    "entity": "reminder",
                    "action": "create",
                    "id": str(uuid.uuid4()),
                    "data": {
                        "vehicle_id": vehicle_id,
                        "title": title,
                        "due_date": (today + timedelta(days=days)).isoformat(),
                        "due_odometer": current + offset if offset else None,
                        "repeat_days": 365,
                        "repeat_km": 10000 if offset else 0,
                        "estimated_cost": "12500" if offset else "",
                        "cost_currency": "RUB",
                    },
                },
            )
        for entity, data in [
            (
                "tire_set",
                {
                    "brand": "Michelin",
                    "model": "Pilot Alpin",
                    "size": "235/55 R19",
                    "season": "winter",
                    "manufacture_code": f"34{(today.year - 3) % 100:02d}",
                    "tread_threshold_mm": "4",
                    "tread_measurements": [{"id": str(uuid.uuid4()), "measured_at": (today - timedelta(days=30)).isoformat(), "depth_mm": "6.4", "notes": "Вымышленный замер демогаража"}],
                    "intervals": [
                        {
                            "mounted_at": (today - timedelta(days=200)).isoformat(),
                            "mounted_km": current - 6000,
                            "removed_at": (today - timedelta(days=110)).isoformat(),
                            "removed_km": current - 1800,
                        }
                    ],
                },
            ),
            ("budget", {"month": today.isoformat()[:7], "amount": "20000", "currency": "RUB"}),
            (
                "recurring_cost",
                {
                    "title": "Парковка · демо",
                    "amount": "3500",
                    "currency": "RUB",
                    "next_date": (today + timedelta(days=14)).isoformat(),
                    "interval_months": 1,
                    "category": "Парковки и дороги",
                },
            ),
        ]:
            store.mutate(
                owner,
                {
                    "operation_id": str(uuid.uuid4()),
                    "entity": entity,
                    "action": "create",
                    "id": str(uuid.uuid4()),
                    "data": {**data, "vehicle_id": vehicle_id},
                },
            )
    return owner
