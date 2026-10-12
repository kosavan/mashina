"""Pure bounded CSV mapping. Raw files and unmapped cells never leave this module."""

import csv
import hashlib
import io
import json
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

MAX_CSV = 2 * 1024 * 1024
DELIMITERS = {"comma": ",", "semicolon": ";", "tab": "\t"}
CURRENCIES = {"RUB", "EUR", "USD"}


class Mapping(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str = Field(min_length=1, max_length=120)
    amount: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=120)
    transaction_id: str | None = Field(default=None, max_length=120)
    currency: str | None = Field(default=None, max_length=120)
    date_format: Literal["iso", "russian"]
    outgoing_sign: Literal["negative", "positive"]
    default_currency: Literal["RUB", "EUR", "USD"]


class BankData(TypedDict):
    date: str
    signed_minor: int
    amount_minor: int | None
    currency: str
    description: str
    transaction_id: str


class ParsedRow(TypedDict):
    ordinal: int
    data: BankData | None
    fingerprint: str
    error: str


def fingerprint(data: BankData) -> str:
    canonical = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _table(content: bytes, encoding: str, delimiter: str) -> tuple[list[str], list[list[str]]]:
    if not content or len(content) > MAX_CSV:
        raise ValueError("CSV должен быть от 1 байта до 2 МБ")
    if encoding not in {"utf-8", "cp1251"} or delimiter not in DELIMITERS:
        raise ValueError("Выберите кодировку и разделитель CSV")
    try:
        decoded = content.decode("utf-8-sig" if encoding == "utf-8" else encoding)
    except UnicodeError:
        raise ValueError("Файл не соответствует выбранной кодировке") from None
    if "\x00" in decoded:
        raise ValueError("CSV содержит недопустимые символы")
    try:
        reader = csv.reader(
            io.StringIO(decoded, newline=""), delimiter=DELIMITERS[delimiter], strict=True
        )
        headers = [v.strip() for v in next(reader)]
        if not 1 <= len(headers) <= 50 or any(not h or len(h) > 120 for h in headers):
            raise ValueError("CSV: от 1 до 50 непустых заголовков длиной до 120 символов")
        if len(set(headers)) != len(headers):
            raise ValueError("Заголовки CSV должны различаться")
        rows = []
        for row in reader:
            if not row:
                continue
            if len(row) != len(headers):
                raise ValueError("Количество ячеек не совпадает с заголовками CSV")
            rows.append(row)
            if len(rows) > 1000:
                raise ValueError("Не более 1000 строк за один импорт")
        return headers, rows
    except (csv.Error, StopIteration):
        raise ValueError("Некорректная структура CSV") from None


def inspect_csv(content: bytes, encoding: str, delimiter: str) -> dict:
    headers, rows = _table(content, encoding, delimiter)
    return {"headers": headers, "row_count": len(rows)}


def _money(value: str) -> int:
    value = value.strip().replace("\u00a0", " ").replace("\u202f", " ")
    if len(value) > 40 or not re.fullmatch(
        r"[+-]?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d{1,2})?", value, flags=re.ASCII
    ):
        raise ValueError("Сумма: число с не более чем двумя знаками после запятой")
    amount = int(Decimal(value.replace(" ", "").replace(",", ".")) * 100)
    if abs(amount) > 10**12:
        raise ValueError("Сумма превышает допустимый предел")
    return amount


def _date(value: str, format_name: str) -> str:
    pattern = r"\d{4}-\d{2}-\d{2}" if format_name == "iso" else r"\d{2}\.\d{2}\.\d{4}"
    if not re.fullmatch(pattern, value, flags=re.ASCII):
        raise ValueError("Дата не соответствует выбранному формату")
    try:
        parsed = (
            date.fromisoformat(value)
            if format_name == "iso"
            else datetime.strptime(value, "%d.%m.%Y").date()
        )
    except ValueError:
        raise ValueError("Некорректная календарная дата") from None
    if not 1900 <= parsed.year <= 2200:
        raise ValueError("Дата должна быть между 1900 и 2200 годом")
    return parsed.isoformat()


def parse_csv(content: bytes, encoding: str, delimiter: str, mapping: Mapping) -> list[ParsedRow]:
    headers, rows = _table(content, encoding, delimiter)
    columns = {
        key: getattr(mapping, key)
        for key in ("date", "amount", "description", "transaction_id", "currency")
    }
    selected = [v for v in columns.values() if v]
    if len(selected) != len(set(selected)) or any(v not in headers for v in selected):
        raise ValueError("Выберите разные существующие столбцы для полей операции")
    indices = {key: headers.index(value) for key, value in columns.items() if value}
    result: list[ParsedRow] = []
    for ordinal, cells in enumerate(rows, 1):
        try:
            values = {key: cells[index].strip() for key, index in indices.items()}
            description = values["description"]
            transaction_id = values.get("transaction_id", "")
            if len(description) > 2000 or len(transaction_id) > 200:
                raise ValueError("Описание до 2000 символов, ID банка до 200 символов")
            currency = values.get("currency", mapping.default_currency).upper()
            if currency not in CURRENCIES:
                raise ValueError("Поддерживаются только RUB, EUR и USD; конвертация не выполняется")
            signed = _money(values["amount"])
            outgoing = signed < 0 if mapping.outgoing_sign == "negative" else signed > 0
            data: BankData = {
                "date": _date(values["date"], mapping.date_format),
                "signed_minor": signed,
                "amount_minor": abs(signed) if outgoing else None,
                "currency": currency,
                "description": description,
                "transaction_id": transaction_id,
            }
            result.append(
                {
                    "ordinal": ordinal,
                    "data": data,
                    "fingerprint": fingerprint(data),
                    "error": ""
                    if outgoing
                    else "Нулевая сумма или входящая операция: можно только пропустить",
                }
            )
        except ValueError as exc:
            result.append({"ordinal": ordinal, "data": None, "fingerprint": "", "error": str(exc)})
    return result
