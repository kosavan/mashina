"""Optional private notification channels and durable delivery receipts."""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notification_identity",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("private_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("public_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("paused", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("telegram_offset", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute("INSERT INTO notification_identity(id) VALUES(1)")
    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("enabled", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("endpoint_hash", sa.String(), unique=True, nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created", sa.Integer(), nullable=False),
    )
    op.create_index("ix_push_user", "push_subscriptions", ["user_id"])
    op.create_table(
        "telegram_links",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("chat_id", sa.String(), unique=True, nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
    )
    op.create_table(
        "telegram_link_codes",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("code_hash", sa.String(), unique=True, nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False),
    )
    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reminder_id", sa.String(), sa.ForeignKey("reminders.id"), nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("destination_id", sa.String(), nullable=False),
        sa.Column("cycle", sa.String(), nullable=False),
        sa.Column("stage", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("auto_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False),
        sa.Column("retry_at", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(), nullable=False, server_default=""),
        sa.CheckConstraint("channel IN ('push','telegram')"),
        sa.CheckConstraint(
            "state IN ('ready','sending','accepted','rejected','uncertain','cancelled','delayed')"
        ),
    )
    op.create_index("ix_notification_user", "notification_deliveries", ["user_id", "updated"])


def downgrade():
    raise RuntimeError("Destructive downgrade refused; restore a verified backup.")
