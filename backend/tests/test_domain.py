import pytest
from backend.domain import normalize_event, fuel_cycles, analytics, reminder_status


def test_exact_items_and_discount():
    record = normalize_event(
        {
            "kind": "maintenance",
            "occurred_at": "2026-01-02",
            "items": [{"name": "Oil", "quantity": "3", "unit_price": "0.10", "discount": "0.01"}],
            "adjustment": "0.02",
        }
    )
    assert record["amount_minor"] == 31


def test_fuel_two_values():
    record = normalize_event(
        {
            "kind": "fuel",
            "occurred_at": "2026-01-02",
            "liters": "40",
            "price": "65.13",
            "odometer": 100,
        }
    )
    assert record["amount_minor"] == 260520
    with pytest.raises(ValueError):
        normalize_event(
            {
                "kind": "fuel",
                "occurred_at": "2026-01-02",
                "liters": "40",
                "price": "65",
                "amount": "1",
                "odometer": 100,
            }
        )


def fuel(km, liters, full=True, gap=False):
    return {
        "kind": "fuel",
        "odometer": km,
        "liters": str(liters),
        "full": full,
        "gap": gap,
        "fuel": "АИ-95",
        "amount_minor": liters * 6000,
        "currency": "RUB",
        "occurred_at": f"2026-01-{km // 100 + 1:02d}",
    }


def test_full_partial_full_and_gap():
    rows = [fuel(0, 40), fuel(200, 10, False), fuel(500, 30)]
    cycles = fuel_cycles(rows)
    assert cycles[0]["consumption"] == 8.0
    assert cycles[0]["distance"] == 500
    assert fuel_cycles([fuel(0, 40), fuel(200, 10, False, True), fuel(500, 30)]) == []
    assert fuel_cycles([fuel(0, 40)]) == []


def test_ownership_mileage_and_currency():
    car = {
        "id": "car",
        "name": "Car",
        "purchase_odometer": 100000,
        "purchase_date": "2026-01-01",
        "purchase_minor": 20000000,
        "currency": "RUB",
    }
    rows = [
        {
            "vehicle_id": "car",
            "kind": "expense",
            "odometer": 102000,
            "occurred_at": "2026-02-01",
            "amount_minor": 100000,
            "currency": "RUB",
        },
        {
            "vehicle_id": "car",
            "kind": "expense",
            "occurred_at": "2026-02-02",
            "amount_minor": 900000,
            "currency": "USD",
        },
    ]
    result = analytics([car], rows)
    assert result["total_minor"] == 100000
    assert result["mileage"] == 2000
    assert result["cost_per_km"] == 0.5
    assert analytics([car], rows, start="2026-01-15")["mileage"] == 2000
    assert analytics([car], [], start="2025-01-01")["cost_per_km"] is None


def test_reminders_either_limit_and_warning():
    assert (
        reminder_status({"due_date": "2026-12-01", "due_odometer": 1000}, 1001, "2026-10-11")[
            "status"
        ]
        == "overdue"
    )
    assert (
        reminder_status({"due_date": "2026-10-20", "warning_days": 30}, 0, "2026-10-11")["status"]
        == "soon"
    )


def test_fuel_cycles_currency_isolation():
    rows = [fuel(0, 40), fuel(500, 30)]
    for row in rows:
        row["currency"] = "USD"
        row["price"] = "60"
    assert analytics([], rows, currency_code="RUB")["consumption"] is None
    assert analytics([], rows, currency_code="USD")["consumption"] == 6
