"""Frozen schema v1, reused by the initial Alembic revision."""

from sqlalchemy import MetaData, Table, Column, String, Integer, Text, ForeignKey, Index


def schema_v1():
    m = MetaData()
    Table(
        "users",
        m,
        Column("id", String, primary_key=True),
        Column("username", String, unique=True, nullable=False),
        Column("password_hash", Text, nullable=False),
        Column("settings", Text, nullable=False, server_default="{}"),
    )
    Table(
        "sessions",
        m,
        Column("token_hash", String, primary_key=True),
        Column("user_id", String, ForeignKey("users.id"), nullable=False),
        Column("csrf", String, nullable=False),
        Column("expires", Integer, nullable=False),
    )
    for name in ("vehicles", "events", "categories", "reminders"):
        columns = [
            Column("id", String, primary_key=True),
            Column("owner_id", String, ForeignKey("users.id"), nullable=False),
            Column("version", Integer, nullable=False),
            Column("data", Text, nullable=False),
            Column("deleted", Integer, nullable=False, server_default="0"),
        ]
        if name in ("events", "reminders"):
            columns.append(Column("vehicle_id", String, ForeignKey("vehicles.id"), nullable=False))
        table = Table(name, m, *columns)
        Index(f"ix_{name}_owner", table.c.owner_id)
        if "vehicle_id" in table.c:
            Index(f"ix_{name}_vehicle", table.c.vehicle_id)
    Table(
        "attachments",
        m,
        Column("id", String, primary_key=True),
        Column("owner_id", String, ForeignKey("users.id"), nullable=False),
        Column("vehicle_id", String, ForeignKey("vehicles.id"), nullable=False),
        Column("event_id", String, ForeignKey("events.id")),
        Column("filename", String, nullable=False),
        Column("data", Text, nullable=False),
    )
    Table(
        "receipts",
        m,
        Column("owner_id", String, ForeignKey("users.id"), primary_key=True),
        Column("operation_id", String, primary_key=True),
        Column("payload_hash", String, nullable=False),
        Column("response", Text, nullable=False),
    )
    Table(
        "audit",
        m,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("owner_id", String, ForeignKey("users.id"), nullable=False),
        Column("entity_id", String, nullable=False),
        Column("action", String, nullable=False),
        Column("occurred_at", String, nullable=False),
        Column("before_data", Text),
        Column("after_data", Text),
    )
    return m
