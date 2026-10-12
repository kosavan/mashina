"""Strict machine inputs and explicit projections: no generic state serialization."""

from typing import Literal
from datetime import date
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ItemInput(StrictInput):
    name: str = Field(min_length=1, max_length=200)
    part_number: str = Field(default="", max_length=100)
    quantity: str = Field(default="1", max_length=40)
    unit_price: str = Field(default="0", max_length=40)
    discount: str = Field(default="0", max_length=40)


class EventInput(StrictInput):
    kind: Literal["expense", "fuel", "maintenance", "odometer", "note"] | None = None
    occurred_at: str | None = Field(default=None, max_length=40)
    currency: str | None = Field(default=None, pattern="^[A-Z]{3}$")
    description: str | None = Field(default=None, max_length=4000)
    odometer: int | None = Field(default=None, ge=0, le=3000000)
    category: str | None = Field(default=None, max_length=300)
    amount: str | None = Field(default=None, max_length=40)
    adjustment: str | None = Field(default=None, max_length=40)
    items: list[ItemInput] | None = Field(default=None, max_length=100)
    vendor: str | None = Field(default=None, max_length=300)
    payment: str | None = Field(default=None, max_length=300)
    tags: str | None = Field(default=None, max_length=300)
    station: str | None = Field(default=None, max_length=300)
    fuel: str | None = Field(default=None, max_length=300)
    liters: str | None = Field(default=None, max_length=40)
    price: str | None = Field(default=None, max_length=40)
    full: bool | None = None
    gap: bool | None = None


class ReminderInput(StrictInput):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    due_date: str | None = Field(default=None, max_length=40)
    due_odometer: int | None = Field(default=None, ge=0, le=3000000)
    warning_days: int | None = Field(default=None, ge=0, le=3000000)
    warning_km: int | None = Field(default=None, ge=0, le=3000000)
    repeat_days: int | None = Field(default=None, ge=0, le=3000000)
    repeat_km: int | None = Field(default=None, ge=0, le=3000000)
    enabled: bool | None = None


class CompletionInput(StrictInput):
    completion_date: str = Field(max_length=10)
    completion_odometer: int | None = Field(default=None, ge=0, le=3000000)

    @field_validator("completion_date")
    @classmethod
    def actual_date(cls, value):
        try:
            parsed = date.fromisoformat(value)
            if parsed.isoformat() != value or parsed > date.today():
                raise ValueError()
        except ValueError:
            raise ValueError(
                "Укажите фактическую дату выполнения, не позднее сегодняшней"
            ) from None
        return value


class MutationInput(StrictInput):
    operation_id: str
    entity: Literal["event", "reminder"]
    id: str
    action: Literal["upsert", "delete", "complete"]
    base_version: int = Field(default=0, ge=0)
    data: dict = Field(default_factory=dict)

    @field_validator("operation_id", "id")
    @classmethod
    def identifier(cls, value):
        return str(uuid.UUID(value))

    @model_validator(mode="after")
    def typed_data(self):
        if self.action == "complete" and (self.entity != "reminder" or self.base_version < 1):
            raise ValueError("Выполнение доступно существующему напоминанию с текущей версией")
        model = (
            CompletionInput
            if self.action == "complete"
            else EventInput
            if self.entity == "event"
            else ReminderInput
        )
        model.model_validate(self.data)
        if self.action == "delete" and self.data:
            raise ValueError("Удаление не принимает изменённые поля")
        return self


EVENT_FIELDS = (
    "id",
    "version",
    "deleted",
    "vehicle_id",
    "kind",
    "occurred_at",
    "currency",
    "description",
    "odometer",
    "category",
    "amount_minor",
    "vendor",
    "payment",
    "tags",
    "station",
    "fuel",
    "liters",
    "price",
    "full",
    "gap",
)
ITEM_FIELDS = ("name", "part_number", "quantity", "unit_price", "discount", "amount_minor")
REMINDER_FIELDS = (
    "id",
    "version",
    "deleted",
    "vehicle_id",
    "title",
    "due_date",
    "due_odometer",
    "warning_days",
    "warning_km",
    "repeat_days",
    "repeat_km",
    "enabled",
    "completed_at",
    "status",
    "remaining_km",
    "remaining_days",
)


def project_record(entity, record):
    fields = EVENT_FIELDS if entity == "event" else REMINDER_FIELDS
    result = {key: record[key] for key in fields if key in record}
    if entity == "event":
        result["items"] = [
            {key: item[key] for key in ITEM_FIELDS if key in item}
            for item in record.get("items", [])
        ]
    return result


ANALYTICS_FIELDS = (
    "total_minor",
    "cost_trend",
    "fuel_minor",
    "maintenance_minor",
    "mileage",
    "cost_per_km",
    "average_month_minor",
    "average_year_minor",
    "average_liter_price",
    "consumption",
    "fuel_cost_per_km",
    "months",
    "categories",
    "years",
    "cars",
    "cycles",
    "fuel_prices",
    "currency",
    "missing_reason",
)
