"""Validate private confirmed bank provenance before any live restore replacement."""

import json
import re
import sqlite3
import uuid
from datetime import date

from backend.bank_csv import CURRENCIES, fingerprint
from backend.domain import text

HASH = re.compile(r"[0-9a-f]{64}")


def _hash(value):
    if not isinstance(value, str) or not HASH.fullmatch(value):
        raise ValueError("Некорректная контрольная сумма банковского журнала")


def validate_bank_archive(c: sqlite3.Connection):
    sources = {}
    for source_id, actor, label, normalized in c.execute(
        "SELECT id,actor_id,label,normalized_label FROM bank_sources"
    ):
        uuid.UUID(source_id)
        if (
            text(label, required=True, maximum=80) != label
            or " ".join(label.casefold().split()) != normalized
        ):
            raise ValueError("Некорректный источник банковской выписки")
        sources[source_id] = actor
    for record in c.execute(
        "SELECT id,actor_id,source_id,vehicle_id,identity,fingerprint,file_hash,row_ordinal,normalized_data,event_id,decision FROM bank_ledger"
    ):
        (
            ledger_id,
            actor,
            source_id,
            vehicle_id,
            identity,
            digest,
            file_hash,
            ordinal,
            raw,
            event_id,
            decision,
        ) = record
        data = json.loads(raw)
        _hash(digest)
        _hash(file_hash)
        if sources.get(source_id) != actor or type(ordinal) is not int or not 1 <= ordinal <= 1000:
            raise ValueError("Несогласованный владелец банковского журнала")
        if not isinstance(data, dict) or set(data) != {
            "date",
            "signed_minor",
            "amount_minor",
            "currency",
            "description",
            "transaction_id",
        }:
            raise ValueError("Некорректные поля банковской операции")
        parsed = date.fromisoformat(data["date"])
        if parsed.isoformat() != data["date"] or not 1900 <= parsed.year <= 2200:
            raise ValueError("Некорректная дата банковской операции")
        signed, amount = data["signed_minor"], data["amount_minor"]
        if type(signed) is not int or abs(signed) > 10**12 or data["currency"] not in CURRENCIES:
            raise ValueError("Некорректная сумма банковской операции")
        if amount is not None and (type(amount) is not int or amount <= 0 or amount != abs(signed)):
            raise ValueError("Несогласованная сумма банковской операции")
        if (
            not isinstance(data["description"], str)
            or len(data["description"]) > 2000
            or not isinstance(data["transaction_id"], str)
            or len(data["transaction_id"]) > 200
        ):
            raise ValueError("Некорректное описание банковской операции")
        expected = (
            "id:" + data["transaction_id"]
            if data["transaction_id"]
            else f"file:{file_hash}:{ordinal}"
        )
        if (
            identity != expected
            or ledger_id != str(uuid.uuid5(uuid.UUID(source_id), identity))
            or fingerprint(data) != digest
        ):
            raise ValueError("Банковская операция не соответствует своей идентичности")
        if decision not in {"create", "link", "ignore"} or (decision == "ignore") != (
            event_id is None
        ):
            raise ValueError("Некорректное решение банковского журнала")
        if event_id:
            target = c.execute("SELECT vehicle_id FROM events WHERE id=?", (event_id,)).fetchone()
            if amount is None or not target or target[0] != vehicle_id:
                raise ValueError("Банковская операция связана с другим автомобилем")
    for actor, operation_id, batch_id, digest, raw in c.execute(
        "SELECT actor_id,operation_id,batch_id,payload_hash,response FROM bank_commit_receipts"
    ):
        uuid.UUID(operation_id)
        uuid.UUID(batch_id)
        _hash(digest)
        response = json.loads(raw)
        if not isinstance(response, dict) or set(response) != {
            "vehicle_id",
            "created",
            "linked",
            "ignored",
            "processed",
            "event_ids",
        }:
            raise ValueError("Некорректное подтверждение банковского импорта")
        if not c.execute("SELECT 1 FROM vehicles WHERE id=?", (response["vehicle_id"],)).fetchone():
            raise ValueError("Автомобиль банковского подтверждения отсутствует")
        counts = [response[k] for k in ("created", "linked", "ignored", "processed")]
        if any(type(v) is not int or v < 0 for v in counts) or not 1 <= sum(counts) <= 1000:
            raise ValueError("Некорректные итоги банковского подтверждения")
        ids = response["event_ids"]
        if (
            not isinstance(ids, list)
            or len(ids) != response["created"]
            or len(set(ids)) != len(ids)
        ):
            raise ValueError("Некорректные записи банковского подтверждения")
        for event_id in ids:
            target = c.execute(
                "SELECT vehicle_id,created_by FROM events WHERE id=?", (event_id,)
            ).fetchone()
            if not target or target != (response["vehicle_id"], actor):
                raise ValueError("Несогласованное авторство банковского подтверждения")
