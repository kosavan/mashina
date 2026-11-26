"""Validated single-vehicle ownership records stored with the vehicle."""

from decimal import Decimal
import json
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from backend.domain import iso

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Quantity = Annotated[
    str, StringConstraints(pattern=r"^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$"),
]


class OwnershipRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Usage(OwnershipRecord):
    event_id: UUID
    quantity: Quantity


class Supply(OwnershipRecord):
    id: UUID
    name: Name
    part_number: str = Field(default="", max_length=120)
    unit: Name = "шт."
    shopping: bool = False
    stock: Quantity = "0"
    uses: list[Usage] = Field(default_factory=list, max_length=80)


class Trip(OwnershipRecord):
    id: UUID
    name: Name
    start: str
    end: str
    event_ids: list[UUID] = Field(default_factory=list, max_length=150)
    people: int = Field(default=1, ge=1, le=99)


class GarageDetails(OwnershipRecord):
    supplies: list[Supply] = Field(default_factory=list, max_length=100)
    trips: list[Trip] = Field(default_factory=list, max_length=100)


def _events_for(connection, vehicle_id, ids):
    if not ids:
        return {}
    keyed = {}
    ids = tuple(ids)
    for start in range(0, len(ids), 500):
        batch = ids[start:start + 500]
        markers = ",".join("?" for _ in batch)
        rows = connection.exec_driver_sql(
            f"SELECT id,data FROM events WHERE vehicle_id=? AND id IN ({markers})",
            (vehicle_id, *batch),
        )
        keyed.update((row[0], json.loads(row[1])) for row in rows)
    return keyed


def normalize_garage_details(connection, vehicle_id, value, previous):
    try:
        details = GarageDetails.model_validate(value)
    except ValidationError:
        raise ValueError("Проверьте поездки и расходники автомобиля") from None
    items, trips = details.supplies, details.trips
    if len({item.id for item in items}) != len(items) or len({trip.id for trip in trips}) != len(trips):
        raise ValueError("Идентификаторы поездок и расходников должны различаться")
    prior_links = {
        str(identity)
        for trip in previous.get("trips", [])
        for identity in trip.get("event_ids", [])
    } | {
        str(use["event_id"])
        for item in previous.get("supplies", [])
        for use in item.get("uses", [])
    }
    event_ids = {str(use.event_id) for item in items for use in item.uses} | {
        str(identity) for trip in trips for identity in trip.event_ids
    }
    events = _events_for(connection, vehicle_id, event_ids)
    if event_ids - events.keys() - prior_links:
        raise ValueError("Выберите записи этого автомобиля")
    for item in items:
        uses = item.uses
        if len({use.event_id for use in uses}) != len(uses):
            raise ValueError("На одно обслуживание можно списать расходник только один раз")
        if any(events.get(str(use.event_id), {}).get("kind", "maintenance") != "maintenance"
               or Decimal(use.quantity) <= 0 for use in uses):
            raise ValueError("Укажите положительное количество и запись обслуживания")
        if sum(Decimal(use.quantity) for use in uses) > Decimal(item.stock):
            raise ValueError("Списание превышает запас расходника")
    for trip in trips:
        if (
            iso(trip.start)[:10] != trip.start or iso(trip.end)[:10] != trip.end
            or trip.start > trip.end
            or len(set(trip.event_ids)) != len(trip.event_ids)
        ):
            raise ValueError("Проверьте даты и записи поездки")
        for identity in trip.event_ids:
            entry = events.get(str(identity))
            if entry and entry["kind"] not in {"expense", "fuel", "maintenance"}:
                raise ValueError("Добавьте к поездке расходы, заправки или обслуживание")
    return details.model_dump(mode="json")
