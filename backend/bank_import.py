"""Private bank provenance. All confirmed financial decisions share one transaction."""

import hashlib
import json
import time
import uuid
from datetime import date, timedelta, datetime, timezone

from sqlalchemy.engine import Connection

from backend.access import vehicle_access
from backend.bank_csv import BankData, ParsedRow, Mapping, parse_csv
from backend.domain import text
from backend.storage import Store, Conflict, Denied, dumps


def _source(c: Connection, actor: str, source_id: str) -> dict:
    row = (
        c.exec_driver_sql(
            "SELECT * FROM bank_sources WHERE id=? AND actor_id=?", (source_id, actor)
        )
        .mappings()
        .first()
    )
    if not row:
        raise Denied("Источник выписки недоступен")
    return dict(row)


def sources(store: Store, actor: str, vehicle_id: str) -> list[dict]:
    with store.transaction() as c:
        vehicle_access(c, vehicle_id, actor, write=True)
        return [
            dict(r)
            for r in c.exec_driver_sql(
                "SELECT id,label FROM bank_sources WHERE actor_id=? ORDER BY label", (actor,)
            ).mappings()
        ]


def add_source(store: Store, actor: str, vehicle_id: str, label: str) -> dict:
    label = text(label, required=True, maximum=80)
    normalized = " ".join(label.casefold().split())
    with store.transaction() as c:
        vehicle_access(c, vehicle_id, actor, write=True)
        prior = (
            c.exec_driver_sql(
                "SELECT id,label FROM bank_sources WHERE actor_id=? AND normalized_label=?",
                (actor, normalized),
            )
            .mappings()
            .first()
        )
        if prior:
            return dict(prior)
        if (
            c.exec_driver_sql(
                "SELECT count(*) FROM bank_sources WHERE actor_id=?", (actor,)
            ).scalar_one()
            >= 100
        ):
            raise ValueError("Не более 100 источников выписок")
        source_id = str(uuid.uuid4())
        c.exec_driver_sql(
            "INSERT INTO bank_sources VALUES(?,?,?,?)", (source_id, actor, label, normalized)
        )
        return {"id": source_id, "label": label}


def identity(row: ParsedRow, file_hash: str) -> str:
    bank_id = row["data"]["transaction_id"]
    return "id:" + bank_id if bank_id else f"file:{file_hash}:{row['ordinal']}"


def _event_matches(data: BankData, event: dict) -> bool:
    if event.get("kind") not in {"expense", "fuel", "maintenance"}:
        return False
    if (
        data["amount_minor"] is None
        or event.get("amount_minor") != data["amount_minor"]
        or event.get("currency") != data["currency"]
    ):
        return False
    return (
        abs((date.fromisoformat(event["occurred_at"][:10]) - date.fromisoformat(data["date"])).days)
        <= 3
    )


def preview(
    store: Store,
    actor: str,
    vehicle_id: str,
    source_id: str,
    content: bytes,
    encoding: str,
    delimiter: str,
    mapping: Mapping,
) -> dict:
    # Authorize before parsing and again inside the snapshot/insert transaction.
    with store.transaction() as c:
        vehicle_access(c, vehicle_id, actor, write=True)
        _source(c, actor, source_id)
    rows = parse_csv(content, encoding, delimiter, mapping)
    file_hash = hashlib.sha256(content).hexdigest()
    now = int(time.time())
    with store.transaction() as c:
        vehicle_access(c, vehicle_id, actor, write=True)
        _source(c, actor, source_id)
        ledger = [
            dict(r)
            for r in c.exec_driver_sql(
                "SELECT identity,fingerprint,file_hash FROM bank_ledger WHERE source_id=?",
                (source_id,),
            ).mappings()
        ]
        prior_by_id = {r["identity"]: r for r in ledger}
        overlaps: dict[str, set[str]] = {}
        for record in ledger:
            overlaps.setdefault(record["fingerprint"], set()).add(record["file_hash"])
        linked = {
            r[0]
            for r in c.exec_driver_sql(
                "SELECT event_id FROM bank_ledger WHERE vehicle_id=? AND event_id IS NOT NULL",
                (vehicle_id,),
            )
        }
        index: dict[tuple[int, str, str], list[dict]] = {}
        for record in c.exec_driver_sql(
            "SELECT id,version,data FROM events WHERE vehicle_id=? AND deleted=0", (vehicle_id,)
        ).mappings():
            event = json.loads(record["data"])
            if (
                event.get("kind") in {"fuel", "expense", "maintenance"}
                and record["id"] not in linked
            ):
                index.setdefault(
                    (event["amount_minor"], event["currency"], event["occurred_at"][:10]), []
                ).append({**event, "id": record["id"], "version": record["version"]})
        for bucket in index.values():
            bucket.sort(key=lambda e: e["id"])
        views = []
        for row in rows:
            data = row["data"]
            prior = prior_by_id.get(identity(row, file_hash)) if data else None
            matches, match_count = [], 0
            if data and not row["error"]:
                day = date.fromisoformat(data["date"])
                for offset in range(-3, 4):
                    bucket = index.get(
                        (
                            data["amount_minor"],
                            data["currency"],
                            (day + timedelta(days=offset)).isoformat(),
                        ),
                        [],
                    )
                    match_count += len(bucket)
                    matches.extend(bucket[:5])
            matches.sort(
                key=lambda e: (
                    abs(
                        (
                            date.fromisoformat(e["occurred_at"][:10])
                            - date.fromisoformat(data["date"])
                        ).days
                    ),
                    e["id"],
                )
            )
            views.append(
                {
                    "row_id": row["ordinal"],
                    "data": data,
                    "error": row["error"],
                    "processed": bool(prior),
                    "conflict": bool(prior and prior["fingerprint"] != row["fingerprint"]),
                    "overlap": bool(
                        data
                        and not data["transaction_id"]
                        and overlaps.get(row["fingerprint"], set()) - {file_hash}
                    ),
                    "candidate_count": match_count,
                    "candidates": [
                        {
                            "id": e["id"],
                            "version": e["version"],
                            "kind": e["kind"],
                            "date": e["occurred_at"][:10],
                            "amount_minor": e["amount_minor"],
                            "currency": e["currency"],
                            "description": e.get("description", "")[:300],
                        }
                        for e in matches[:5]
                    ],
                }
            )
        c.exec_driver_sql("DELETE FROM bank_preview_batches WHERE expires<=?", (now,))
        oldest = c.exec_driver_sql(
            "SELECT id FROM bank_preview_batches WHERE actor_id=? ORDER BY created DESC,rowid DESC LIMIT -1 OFFSET 2",
            (actor,),
        ).all()
        for (old_id,) in oldest:
            c.exec_driver_sql("DELETE FROM bank_preview_batches WHERE id=?", (old_id,))
        batch_id = str(uuid.uuid4())
        c.exec_driver_sql(
            "INSERT INTO bank_preview_batches VALUES(?,?,?,?,?,?,?,?)",
            (batch_id, actor, source_id, vehicle_id, file_hash, dumps(rows), now, now + 1800),
        )
        return {"batch_id": batch_id, "expires": now + 1800, "rows": views}


def commit(store: Store, actor: str, payload: dict) -> dict:
    digest = hashlib.sha256(dumps(payload).encode()).hexdigest()
    operation_id, batch_id = payload["operation_id"], payload["batch_id"]
    now = int(time.time())
    with store.transaction() as c:
        prior_receipt = (
            c.exec_driver_sql(
                "SELECT * FROM bank_commit_receipts WHERE actor_id=? AND operation_id=?",
                (actor, operation_id),
            )
            .mappings()
            .first()
        )
        if prior_receipt:
            result = json.loads(prior_receipt["response"])
            vehicle_access(c, result["vehicle_id"], actor, write=True)
            if digest != prior_receipt["payload_hash"]:
                raise Conflict("Идентификатор подтверждения уже использован с другими решениями")
            return result
        batch = (
            c.exec_driver_sql(
                "SELECT * FROM bank_preview_batches WHERE id=? AND actor_id=?", (batch_id, actor)
            )
            .mappings()
            .first()
        )
        if not batch:
            raise Denied("Предпросмотр недоступен. Загрузите выписку заново.")
        vehicle_id, source_id = batch["vehicle_id"], batch["source_id"]
        vehicle_access(c, vehicle_id, actor, write=True)
        _source(c, actor, source_id)
        if batch["expires"] <= now:
            raise Conflict("Предпросмотр истёк. Загрузите выписку заново.")
        rows = {r["ordinal"]: r for r in json.loads(batch["rows_json"])}
        decisions = payload["decisions"]
        if len({d["row_id"] for d in decisions}) != len(decisions):
            raise ValueError("Для каждой строки требуется одно решение")
        result = {
            "vehicle_id": vehicle_id,
            "created": 0,
            "linked": 0,
            "ignored": 0,
            "processed": 0,
            "event_ids": [],
        }
        for choice in decisions:
            row = rows.get(choice["row_id"])
            if not row or not row["data"]:
                raise ValueError("Некорректная строка предпросмотра")
            data, action = row["data"], choice["action"]
            row_identity = identity(row, batch["file_hash"])
            prior = c.exec_driver_sql(
                "SELECT fingerprint FROM bank_ledger WHERE source_id=? AND identity=?",
                (source_id, row_identity),
            ).first()
            if prior:
                if prior[0] != row["fingerprint"]:
                    raise Conflict("ID банка уже подтверждён с другими данными")
                result["processed"] += 1
                continue
            if action != "ignore" and row["error"]:
                raise ValueError(row["error"])
            if action != "ignore" and not data["transaction_id"] and not choice["ack_separate"]:
                if c.exec_driver_sql(
                    "SELECT 1 FROM bank_ledger WHERE source_id=? AND fingerprint=? AND file_hash<>? LIMIT 1",
                    (source_id, row["fingerprint"], batch["file_hash"]),
                ).first():
                    raise Conflict(
                        "Похожая операция есть в другой выписке. Подтвердите, что это отдельная покупка."
                    )
            ledger_id = str(uuid.uuid5(uuid.UUID(source_id), row_identity))
            event_id = None
            if action == "create":
                event_id = str(uuid.uuid5(uuid.UUID(ledger_id), "event"))
                amount = data["amount_minor"]
                event = {
                    "vehicle_id": vehicle_id,
                    "kind": "expense",
                    "occurred_at": data["date"],
                    "amount": f"{amount // 100}.{amount % 100:02d}",
                    "currency": data["currency"],
                    "description": choice["description"]
                    if choice["description"] is not None
                    else data["description"],
                    "category": choice["category"] or "Прочее",
                }
                store.mutate(
                    actor,
                    {
                        "operation_id": str(uuid.uuid5(uuid.UUID(ledger_id), "mutation")),
                        "id": event_id,
                        "entity": "event",
                        "action": "create",
                        "data": event,
                    },
                    connection=c,
                )
                result["created"] += 1
                result["event_ids"].append(event_id)
            elif action == "link":
                event_id = choice["event_id"]
                target = (
                    c.exec_driver_sql(
                        "SELECT * FROM events WHERE id=? AND vehicle_id=? AND deleted=0",
                        (event_id, vehicle_id),
                    )
                    .mappings()
                    .first()
                )
                if (
                    not target
                    or target["version"] != choice["expected_version"]
                    or not _event_matches(data, json.loads(target["data"]))
                ):
                    raise Conflict("Совпадение изменилось или удалено. Обновите предпросмотр.")
                if c.exec_driver_sql(
                    "SELECT 1 FROM bank_ledger WHERE event_id=?", (event_id,)
                ).first():
                    raise Conflict("Запись уже связана с подтверждённой операцией")
                result["linked"] += 1
            else:
                result["ignored"] += 1
            c.exec_driver_sql(
                "INSERT INTO bank_ledger VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    ledger_id,
                    actor,
                    source_id,
                    vehicle_id,
                    row_identity,
                    row["fingerprint"],
                    batch["file_hash"],
                    row["ordinal"],
                    dumps(data),
                    event_id,
                    action,
                    now,
                ),
            )
            c.exec_driver_sql(
                "INSERT INTO audit(owner_id,entity_id,action,occurred_at) VALUES(?,?,?,?)",
                (actor, ledger_id, "bank_" + action, datetime.now(timezone.utc).isoformat()),
            )
        c.exec_driver_sql(
            "INSERT INTO bank_commit_receipts VALUES(?,?,?,?,?,?)",
            (actor, operation_id, batch_id, digest, dumps(result), now),
        )
        return result


def export_private(store: Store, actor: str, vehicle_id: str) -> dict:
    with store.transaction() as c:
        vehicle_access(c, vehicle_id, actor, write=True)
        ledger = []
        for r in c.exec_driver_sql(
            "SELECT * FROM bank_ledger WHERE actor_id=? AND vehicle_id=? ORDER BY created,id",
            (actor, vehicle_id),
        ).mappings():
            ledger.append({**dict(r), "normalized_data": json.loads(r["normalized_data"])})
        return {
            "format": 1,
            "vehicle_id": vehicle_id,
            "sources": [
                dict(r)
                for r in c.exec_driver_sql(
                    "SELECT id,label FROM bank_sources WHERE actor_id=? ORDER BY id", (actor,)
                ).mappings()
            ],
            "ledger": ledger,
        }
