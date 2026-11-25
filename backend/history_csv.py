"""Bounded column mapping for history spreadsheets."""

import csv
import io
import re
from collections.abc import Iterator
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.ownership import CSV_COLUMNS

MAX_CSV = 2 * 1024 * 1024
HEADER_NAMES = {
    "external_id": ("id", "row id", "transaction id", "внешний id", "идентификатор"),
    "occurred_at": ("date", "datetime", "date time", "fill up date", "дата", "дата и время"),
    "kind": ("type", "record type", "тип", "тип записи"),
    "amount": ("total", "total cost", "cost", "total paid", "сумма", "стоимость", "итого"),
    "description": ("notes", "comment", "memo", "описание", "примечание", "комментарий"),
    "category": ("category name", "категория"),
    "odometer": ("odometer km", "odometer reading", "mileage", "пробег", "одометр", "пробег км"),
    "currency": ("currency code", "валюта", "код валюты"),
    "liters": ("litres", "volume", "fuel volume", "литры", "литров", "объём топлива"),
    "price": ("unit price", "price per litre", "price per liter", "цена", "цена за литр"),
    "full": ("full tank", "tank full", "полный бак", "до полного бака"),
    "gap": ("missed fill up", "пропуск", "пропущена заправка"),
    "fuel": ("fuel type", "вид топлива", "тип топлива", "марка топлива"),
    "station": ("fuel station", "gas station", "petrol station", "азс", "бензоколонка"),
    "vendor": ("merchant", "supplier", "продавец", "поставщик"),
    "tags": ("labels", "теги", "метки"),
}
KIND_NAMES = {
    "заправка": "fuel",
    "топливо": "fuel",
    "fuel fill up": "fuel",
    "fill up": "fuel",
    "расход": "expense",
    "трата": "expense",
    "то": "maintenance",
    "обслуживание": "maintenance",
    "service": "maintenance",
    "пробег": "odometer",
    "заметка": "note",
}
BOOLEAN_NAMES = {"yes": "true", "y": "true", "no": "false", "n": "false"}
CURRENCY_NAMES = {"£": "GBP", "€": "EUR", "₽": "RUB", "руб": "RUB"}
DMY = re.compile(r"(\d{1,2})([./])(\d{1,2})\2(\d{4})([ T]\d{2}:\d{2}(?::\d{2})?)?")
Header = Annotated[str, Field(min_length=1, max_length=120)]
Kind = Literal["expense", "fuel", "maintenance", "odometer", "note"]
DateFormat = Literal["iso", "dmy"]


class HistoryMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")
    columns: dict[str, Header] = Field(max_length=len(CSV_COLUMNS))
    default_kind: Kind | None = None
    date_format: DateFormat = "iso"
    default_currency: str = Field(pattern=r"^[A-Za-z]{3}$")


def _header_name(value: str) -> str:
    return re.sub(r"[\W_]+", " ", value.casefold().replace("ё", "е")).strip()


def read_history_csv(blob: bytes) -> tuple[list[str], list[list[str]]]:
    if len(blob) > MAX_CSV:
        raise ValueError("CSV превышает 2 МБ")
    try:
        content = blob.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("Сохраните CSV в UTF-8") from None
    if not content or "\x00" in content:
        raise ValueError("Некорректная структура CSV")
    choices = []
    for delimiter in (",", ";", "\t"):
        reader = csv.reader(io.StringIO(content, newline=""), delimiter=delimiter, strict=True)
        try:
            headers = [value.strip() for value in next(reader)]
        except (csv.Error, StopIteration):
            continue
        choices.append((headers, reader))
    if not choices:
        raise ValueError("Некорректная структура CSV")
    headers, reader = max(choices, key=lambda choice: len(choice[0]))
    if not 1 <= len(headers) <= 50 or any(not value or len(value) > 120 for value in headers):
        raise ValueError("CSV: от 1 до 50 непустых заголовков длиной до 120 символов")
    if len(headers) != len(set(headers)):
        raise ValueError("Заголовки CSV должны различаться")
    rows = []
    try:
        for row in reader:
            if not row:
                continue
            if len(row) != len(headers):
                raise ValueError("Количество ячеек не совпадает с заголовками CSV")
            if len(rows) >= 1000:
                raise ValueError("Не более 1000 строк")
            rows.append(row)
    except csv.Error:
        raise ValueError("Некорректная структура CSV") from None
    return headers, rows


def inspect_history_csv(blob: bytes) -> dict:
    headers, rows = read_history_csv(blob)
    normalized = {header: _header_name(header) for header in headers}
    columns = {}
    for field, aliases in HEADER_NAMES.items():
        names = {_header_name(field), *(_header_name(alias) for alias in aliases)}
        matches = [header for header in headers if normalized[header] in names]
        if field in matches:
            columns[field] = field
        elif len(matches) == 1:
            columns[field] = matches[0]
    date_index = headers.index(columns["occurred_at"]) if "occurred_at" in columns else None
    dates = [row[date_index].strip() for row in rows[:20] if date_index is not None]
    dates = [value for value in dates if value]
    return {
        "headers": headers,
        "row_count": len(rows),
        "columns": columns,
        "default_kind": "fuel" if "kind" not in columns and "liters" in columns else None,
        "date_format": "dmy" if dates and all(DMY.fullmatch(value) for value in dates) else "iso",
    }


def mapped_sources(blob: bytes, mapping: HistoryMapping) -> Iterator[dict[str, str]]:
    headers, rows = read_history_csv(blob)
    columns = mapping.columns
    selected = list(columns.values())
    if set(columns) - CSV_COLUMNS or set(selected) - set(headers) or len(set(selected)) != len(selected):
        raise ValueError("Проверьте сопоставление колонок CSV")
    if "occurred_at" not in columns or ("kind" not in columns and not mapping.default_kind):
        raise ValueError("Сопоставьте дату и тип записи или выберите тип по умолчанию")
    indices = {field: headers.index(header) for field, header in columns.items()}
    for row in rows:
        source = {field: row[index].strip() for field, index in indices.items()}
        raw_kind = source.get("kind") or mapping.default_kind or ""
        kind_name = _header_name(raw_kind)
        source["kind"] = KIND_NAMES.get(kind_name, kind_name)
        if mapping.date_format == "dmy" and (match := DMY.fullmatch(source["occurred_at"])):
            day, _, month, year, clock = match.groups()
            source["occurred_at"] = f"{year}-{int(month):02d}-{int(day):02d}{clock or ''}"
        if source.get("currency") in CURRENCY_NAMES:
            source["currency"] = CURRENCY_NAMES[source["currency"]]
        for field in ("full", "gap"):
            if field in source:
                source[field] = BOOLEAN_NAMES.get(source[field].casefold(), source[field])
        yield source
