"""Strict untrusted suggestions, separate from explicitly reviewed event validation.

No I/O, provider actions, persistence, or authority-bearing fields belong here.
Missing extraction facts remain missing rather than acquiring domain defaults.
"""

from datetime import date
from decimal import Decimal
import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from backend.domain import minor, normalize_event

MAX_RESULT = 128 * 1024
Money = Annotated[str, StringConstraints(strict=True, pattern=r"^\d{1,10}(?:[.,]\d{1,2})?$")]
Quantity = Annotated[str, StringConstraints(strict=True, pattern=r"^\d{1,10}(?:[.,]\d{1,6})?$")]
ShortText = Annotated[str, StringConstraints(strict=True, max_length=300)]


class SuggestedItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: Annotated[str, StringConstraints(max_length=200)] | None = None
    part_number: Annotated[str, StringConstraints(max_length=100)] | None = None
    quantity: Quantity | None = None
    unit_price: Money | None = None
    discount: Money | None = None

    @field_validator("quantity")
    @classmethod
    def positive_quantity(cls, value):
        if value is not None and Decimal(value.replace(",", ".")) <= 0:
            raise ValueError("Количество должно быть больше нуля")
        return value


class SuggestedData(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    kind: Literal["expense", "fuel", "maintenance"] | None = None
    occurred_at: Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    amount: Money | None = None
    liters: Quantity | None = None
    price: Quantity | None = None
    odometer: Annotated[int, Field(ge=0, le=3000000)] | None = None
    full: bool | None = None
    description: Annotated[str, StringConstraints(max_length=4000)] | None = None
    vendor: ShortText | None = None
    station: ShortText | None = None
    fuel: ShortText | None = None
    category: ShortText | None = None
    items: list[SuggestedItem] = Field(default_factory=list, max_length=100)

    @field_validator("occurred_at")
    @classmethod
    def actual_date(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value

    @field_validator("liters", "price")
    @classmethod
    def positive_fuel_value(cls, value):
        if value is not None and Decimal(value.replace(",", ".")) <= 0:
            raise ValueError("Литры и цена должны быть больше нуля")
        return value


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Повторяющееся поле в ответе")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError("Недопустимое число в ответе")


def parse_suggestion(content: str) -> SuggestedData:
    """Reject ambiguous/oversized JSON. Never expose provider input in errors."""
    if not isinstance(content, str) or len(content.encode("utf-8")) > MAX_RESULT:
        raise ValueError("Ответ распознавания слишком большой")
    try:
        data = json.loads(
            content, object_pairs_hook=_unique_object, parse_constant=_reject_constant
        )
        return SuggestedData.model_validate(data)
    except (ValueError, TypeError, RecursionError):
        raise ValueError("Ответ распознавания не соответствует безопасному формату") from None


def reviewed_event(data: dict) -> dict:
    """Validate deliberate human input without inventing a total or missing prices.

    Identity, provenance and an explicit odometer-correction acknowledgement are
    supplied/checked by the transactional review layer, never by the processor.
    """
    try:
        reviewed = SuggestedData.model_validate(data)
    except ValueError:
        raise ValueError("Проверьте поля записи и числовые значения") from None
    if not reviewed.kind or not reviewed.occurred_at or not reviewed.currency:
        raise ValueError("Выберите тип записи, дату и валюту")
    values = reviewed.model_dump(exclude_none=True)
    if reviewed.kind == "fuel":
        if reviewed.items:
            raise ValueError("Заправка не поддерживает позиции заказ-наряда")
        if reviewed.odometer is None:
            raise ValueError("Для заправки нужен подтверждённый пробег")
    elif reviewed.items:
        for item in reviewed.items:
            if (
                not item.name
                or not item.name.strip()
                or item.quantity is None
                or item.unit_price is None
            ):
                raise ValueError("Заполните название, количество и цену каждой позиции")
        values["items"] = [
            {key: value for key, value in item.model_dump().items() if value is not None}
            for item in reviewed.items
        ]
    elif reviewed.amount is None:
        raise ValueError("Введите итоговую сумму или заполните позиции")
    # Shared domain logic validates dates, bounds, discounts and fuel consistency.
    normalized = normalize_event(values)
    if normalized["amount_minor"] <= 0:
        raise ValueError("Подтвердите сумму больше нуля")
    if reviewed.kind != "fuel" and reviewed.items and reviewed.amount is not None:
        if minor(reviewed.amount) != normalized["amount_minor"]:
            raise ValueError("Сумма позиций не совпадает с итогом. Исправьте позиции или итог")
    return normalized
